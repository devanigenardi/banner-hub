import fs from 'fs/promises';
import express from 'express';
import open from 'open';
import chokidar from 'chokidar';
import { fileURLToPath } from 'url';
import { resolve, join, dirname, relative } from 'path';
import { global } from './_global.mjs';
import { packaging } from './packaging.mjs';
import { customAlphabet } from 'nanoid';
import { existsSync, readdirSync, statSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const parentDirectory = resolve(__dirname, '..');

const nanoid = customAlphabet('1234567890abcdef', 5);

// Check if preview directory exists
async function ifPreviewdirectoryExists() {
  try {
    const stats = await fs.stat(previewPath);
    return stats.isDirectory();
  } catch (error) {
    return false;
  }
}

// Delete pre-existing directory
async function deletePreviewDirectory() {
  const entries = await fs.readdir(previewPath, { withFileTypes: true });
  for (let entry of entries) {
    const entryPath = join(previewPath, entry.name);
    if (entry.isDirectory()) {
      await deleteDirectory(entryPath);
    } else {
      await fs.unlink(entryPath);
    }
  }
  await fs.rmdir(previewPath);
}

// Function to get sizes from folder names
async function getBannerSizes(rootDir) {
  const sizes = await fs.readdir(rootDir);
  return sizes.filter(size => /^\d+x\d+(?:_.*)?$/.test(size)); // allow folders that match the pattern "000x000" and "000x000_blabla"
}

// Function to recursively copy folder
async function copyFolder(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    entry.isDirectory() ?
      await copyFolder(srcPath, destPath) :
      await fs.copyFile(srcPath, destPath);
  }
}

// Function to extract base size (000x000) from the folder name
function extractBaseSize(size) {
  const match = size.match(/^\d+x\d+/);
  return match ? match[0] : null;
}

// Format file size nicely
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Read ZIP filesizes from the latest published folder
function getZipFilesizes(publishedDir) {
  const sizesMap = {};
  try {
    if (!existsSync(publishedDir)) return sizesMap;
    const dateFolders = readdirSync(publishedDir).filter(f => !f.startsWith('.'));
    if (dateFolders.length === 0) return sizesMap;
    dateFolders.sort();
    const latestFolder = join(publishedDir, dateFolders[dateFolders.length - 1]);
    const files = readdirSync(latestFolder).filter(f => f.endsWith('.zip'));
    for (const file of files) {
      const filePath = join(latestFolder, file);
      const stats = statSync(filePath);
      const sizeMatch = file.match(/(\d+x\d+(?:_[^.]*)?)/);
      if (sizeMatch) {
        sizesMap[sizeMatch[1]] = {
          formatted: formatFileSize(stats.size),
          bytes: stats.size
        };
      }
    }
  } catch (err) {
    // Silently fail — zip sizes are optional
  }
  return sizesMap;
}

// Get the max filesize limit (in KB) for a given banner size
function getMaxFileSize(size) {
  const settings = global.loadCampaignSettings();
  if (settings && settings.fileSizeLimits && settings.fileSizeLimits[size]) {
    return settings.fileSizeLimits[size];
  }
  return global.defaultMaxFileSize;
}

// Get the max animation duration (in seconds) for a given banner size
function getMaxDuration(size) {
  const settings = global.loadCampaignSettings();
  if (settings && settings.durationLimits && settings.durationLimits[size]) {
    return settings.durationLimits[size];
  }
  return global.defaultMaxDuration;
}

export async function preview(expressMode = false) {
  try {
      const latestVersionDir = await global.getLatestVersionDir(join(parentDirectory, 'banner-sizes'));
      const latestVersionPath = join(parentDirectory, 'banner-sizes', latestVersionDir);
      const previewPath = join(parentDirectory, '_temporal_preview');

      // If _temporal_preview directory exists, delete it
      if (await ifPreviewdirectoryExists()) {
          await deletePreviewDirectory();
      }

      let sizes = await getBannerSizes(latestVersionPath);

      // Extract base sizes for comparison
      const baseSizes = sizes.map(size => extractBaseSize(size));

      // Filter sizes based on global sizes
      sizes = sizes.filter(size => global.sizes.includes(extractBaseSize(size)));

      // Copy latest version folder to _temporal_preview
      await copyFolder(latestVersionPath, previewPath);

      // Package banners and read ZIP filesizes
      const packageDir = await packaging();
      const zipSizes = getZipFilesizes(join(packageDir, '..'));

      // Read test results if available
      let testResults = null;
      const testResultsPath = join(parentDirectory, 'reports', 'test-results.json');
      try {
          if (existsSync(testResultsPath)) {
              testResults = JSON.parse(await fs.readFile(testResultsPath, 'utf8'));
          }
      } catch (err) {}

      // Read optimize report if available
      let optimizeReport = null;
      const optimizeReportPath = join(parentDirectory, 'reports', 'optimize-report.json');
      try {
          if (existsSync(optimizeReportPath)) {
              optimizeReport = JSON.parse(await fs.readFile(optimizeReportPath, 'utf8'));
          }
      } catch (err) {}

      const iframes = sizes.map((size, index) => {
          const [width, height] = extractBaseSize(size).split('x');
          const zipData = zipSizes[size];
          const maxKB = getMaxFileSize(size);
          const isOverLimit = zipData && (zipData.bytes / 1024) > maxKB;
          const sizeClass = zipData ? (isOverLimit ? ' over-limit' : ' under-limit') : '';
          const maxDur = getMaxDuration(size);

          // Compute optimization status for this size
          let optTotal = 0, optDone = 0;
          if (optimizeReport && optimizeReport.assets) {
              const sizePrefix = size + '/images/';
              for (const [key, val] of Object.entries(optimizeReport.assets)) {
                  if (key.startsWith(sizePrefix)) {
                      optTotal++;
                      if (val.passes > 0) optDone++;
                  }
              }
          }
          const optStatus = optTotal === 0 ? 'none' : (optDone === optTotal ? 'optimized' : 'partial');
          const limitTitle = zipData ? `Package size (limit: ${maxKB} KB)` : 'Package size';
          return `
          <div class="banner-slot" data-size="${size}" data-max-duration="${maxDur}" data-max-filesize="${maxKB}" data-filesize="${zipData ? zipData.formatted : ''}" data-filesize-bytes="${zipData ? zipData.bytes : ''}" data-opt-status="${optStatus}" data-opt-total="${optTotal}" data-opt-done="${optDone}">

            <div class="top-bar">
              <div class="banner-indicators">
                <span class="indicator" title="Dimensions"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 60 60" fill="white"><path d="M11.1,45.2h-6.1v8.3l13-13V6c0-.5-.5-1-1-1H6c-.6,0-1,.5-1,1v4.5h6.1c.6,0,1,.4,1,1s-.4,1-1,1h-6.1v3.5h2.1c.6,0,1,.4,1,1s-.4,1-1,1h-2.1v3.5h6.1c.6,0,1,.4,1,1s-.4,1-1,1h-6.1v3.5h2.1c.6,0,1,.4,1,1s-.4,1-1,1h-2.1v3.5h6.1c.6,0,1,.4,1,1s-.4,1-1,1h-6.1v3.5h2.1c.6,0,1,.4,1,1s-.4,1-1,1h-2.1v3.5h6.1c.6,0,1,.4,1,1s-.4,1-1,1Z"/><path d="M54,42H19.4l-13,13h8.3v-6.1c0-.5.4-1,1-1s1,.5,1,1v6.1h3.5v-2.1c0-.5.5-1,1-1s1,.5,1,1v2.1h3.5v-6.1c0-.5.4-1,1-1s1,.5,1,1v6.1h3.5v-2.1c0-.5.5-1,1-1s1,.5,1,1v2.1h3.5v-6.1c0-.5.5-1,1-1s1,.5,1,1v6.1h3.5v-2.1c0-.5.4-1,1-1s1,.5,1,1v2.1h3.5v-6.1c0-.5.4-1,1-1s1,.5,1,1v6.1h4.5c.5,0,1-.5,1-1v-11c0-.5-.5-1-1-1Z"/></svg> ${size}</span>
                ${zipData ? `<span class="indicator${sizeClass}" title="${limitTitle}"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 300 300" fill="white"><path d="M287.2,282.152l-31.829-177.579c-1.281-7.149-7.501-12.353-14.765-12.353h-52.935c9.925-9.776,16.093-23.357,16.093-38.356C203.764,24.163,179.601,0,149.9,0S96.035,24.163,96.035,53.864c0,14.999,6.168,28.58,16.093,38.356H59.193c-7.264,0-13.483,5.204-14.765,12.353L12.599,282.152c-0.783,4.372,0.41,8.866,3.261,12.272c2.85,3.406,7.063,5.374,11.504,5.374h245.071c4.441,0,8.654-1.968,11.504-5.374C286.789,291.018,287.983,286.524,287.2,282.152z M149.9,30c13.159,0,23.864,10.705,23.864,23.864c0,13.159-10.705,23.865-23.864,23.865c-13.159,0-23.865-10.706-23.865-23.865C126.035,40.705,136.741,30,149.9,30z"/><text x="150" y="235" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="120" fill="#2c2c2c">KB</text></svg> <span class="filesize-value">${zipData.formatted}</span></span>` : ''}
                <span class="indicator clicktag-label" id="clicktag_${index}" title="ClickTags"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 64 64" fill="white" clip-rule="evenodd" fill-rule="evenodd"><path d="M2 8v20.225c0 2.121.84 4.155 2.34 5.656 5.01 5.006 19.38 19.393 25.87 25.832 2.58 2.587 6.61 3.077 9.74 1.184.01-.004.02-.007.02-.011 8.55-5.278 15.52-12.229 20.9-20.872.01-.007.01-.014.02-.021 1.9-3.151 1.41-7.197-1.19-9.801-6.46-6.462-20.83-20.842-25.83-25.847-1.5-1.502-3.54-2.345-5.66-2.345H8c-3.31 0-6 2.686-6 6zm14 2c-3.31 0-6 2.689-6 6s2.69 6 6 6 6-2.689 6-6-2.69-6-6-6z"/></svg> <span class="clicktag-value">—</span></span>
                <span class="indicator duration-label" id="duration_${index}" title="Animation duration"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 512 512" fill="white"><path d="m500.84 128.68c-1.49-2.83-8.45-15.36-32.28-39.12s-36.29-30.79-39.12-32.28c-4.68-2.44-11.77-2.24-16 .57a49.87 49.87 0 0 0 -9.35 8.35 51.8 51.8 0 0 0 -7.09 10.31c-2.31 4.49-1.78 11.49 1 15.71 1.19 1.83 5.69 7.14 16 17.93l-26.42 26.45a209.63 209.63 0 0 0 -107.58-44.76v-27.71c28.37-.32 51-1.11 53.86-1.73 6-1.28 12.33-6.75 14.23-12.53a62.91 62.91 0 0 0 2.71-14.87 60.73 60.73 0 0 0 -.86-15.09c-1.19-6-7.06-12.18-13.13-14.09-3.67-1.13-40.27-5.82-80.81-5.82-40.54 0-77.14 4.69-80.81 5.83-6.07 1.91-11.94 8.12-13.13 14.09a60.73 60.73 0 0 0 -.86 15.08 62.91 62.91 0 0 0 2.71 14.86c1.9 5.78 8.25 11.25 14.23 12.53 2.9.62 25.49 1.41 53.86 1.73v27.72c-105.1 11.91-186.77 101.16-186.77 209.39 0 116.41 94.37 210.77 210.77 210.77s210.77-94.36 210.77-210.77a209.92 209.92 0 0 0 -45.34-130.6l26.57-26.54c10.8 10.37 16.1 14.87 17.94 16.06 4.26 2.75 11.2 3.27 15.71 1a52.09 52.09 0 0 0 10.27-7.15 50.61 50.61 0 0 0 8.35-9.36c2.81-4.19 3.01-11.29.57-15.96zm-143.84 241.61a19 19 0 0 1 -26.4 5l-85.31-58.33a19 19 0 0 1 -8.29-15.72v-132.12a19 19 0 0 1 38 0v122.09l77 52.67a19 19 0 0 1 5 26.41z"/></svg> <span class="duration-value">—</span></span>
              </div>

              <div class="top-bar-buttons">
                <button class="open-tab" title="Open in new tab">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </button>
                <button class="refresh">
                  <?xml version="1.0" encoding="UTF-8"?><svg id="Layer_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><style>.cls-1{fill:gray;stroke-width:0px;}</style></defs><path class="cls-1" d="m40,0C17.91,0,0,17.91,0,40s17.91,40,40,40c22.09,0,40-17.91,40-40S62.09,0,40,0Zm0,64.81c-13.9,0-25.16-11.27-25.16-25.16s10.29-24.16,23.34-25.09v-7.65s-.04-.4.26-.51c.29-.11.62.12.62.12l15.4,11.28s.32.2.32.47c0,.33-.32.5-.32.5l-15.45,12.33s-.28.17-.56,0c-.28-.17-.27-.44-.27-.44v-8.33c-8.76.91-15.59,8.32-15.59,17.32,0,9.62,7.8,17.42,17.41,17.42s17.42-7.8,17.42-17.42c0-2.74-.63-5.32-1.76-7.63,0,0-1.46-3.26,1.56-4.74,3.01-1.48,4.8.15,5.17.86,1.78,3.45,2.78,7.36,2.78,11.51,0,13.9-11.27,25.16-25.17,25.16Z"/></svg>
                </button>
              </div>
            </div>

            <div class="iframe-wrapper">
              <div class="adchoices-logo"></div>
              <iframe id="frame_${index}" src="./${size}/index.html?v=${nanoid()}" width="${width}" height="${height}" data-size="${size}" data-max-duration="${maxDur}"></iframe>
            </div>
          </div>
          `;
      }).join('\n');

      const checkboxes = sizes.map((size, index) => {
          const zipData = zipSizes[size];
          const maxKB = getMaxFileSize(size);
          const isOverLimit = zipData && (zipData.bytes / 1024) > maxKB;
          const sizeClass = zipData ? (isOverLimit ? ' over-limit' : ' under-limit') : '';
          const zipSizeDisplay = zipData ? ` <span class="zip-size${sizeClass}">${zipData.formatted}</span>` : '';
          return `<input type="checkbox" id="checkbox_${index}" value="${size}" data-zipsize="${zipData ? zipData.formatted : ''}" checked>
                  <label for="checkbox_${index}">${size}${zipSizeDisplay}</label><br>`;
      }).join('\n');

      const data = await fs.readFile(join(parentDirectory, 'assets', 'preview-template.html'), 'utf8');
      const previousSettings = global.loadCampaignSettings();

      const htmlTemplate = data
          .replace('{iframes}', iframes)
          .replace('{checkboxes}', checkboxes)
          .replaceAll('{client}', previousSettings.client ? previousSettings.client : "Not Specified")
          .replaceAll('{brand}', previousSettings.brand ? previousSettings.brand : "Not Specified")
          .replaceAll('{campaign}', previousSettings.campaign ? previousSettings.campaign : "Not Specified")
          .replaceAll('{concept}', previousSettings.concept ? previousSettings.concept : "Not Specified")
          .replace('{downloadLinks}', '');

      // Inject hot-reload SSE client script (only for local preview, not upload mode)
      const hotReloadScript = !expressMode ? `
      <script>
      (function() {
        var es = new EventSource('/__reload');
        es.onmessage = function() {
          location.reload();
        };
        es.onerror = function() {
          setTimeout(function() { location.reload(); }, 2000);
        };
      })();
      </script>` : '';

      const testResultsScript = testResults
          ? `<script>window.__testResults = ${JSON.stringify(testResults)};</script>`
          : '<script>window.__testResults = null;</script>';

      const optimizeReportScript = optimizeReport
          ? `<script>window.__optimizeReport = ${JSON.stringify(optimizeReport)};</script>`
          : '<script>window.__optimizeReport = null;</script>';

      const finalHtml = htmlTemplate.replace('</body>', testResultsScript + '\n' + optimizeReportScript + '\n' + hotReloadScript + '\n</body>');

      const filePath = join(previewPath, 'index.html');
      await fs.writeFile(filePath, finalHtml);

      if (!expressMode) console.log('index.html has been created in _temporal_preview.');

      // Generate individual detail pages per size
      const detailDir = join(previewPath, 'detail');
      await fs.mkdir(detailDir, { recursive: true });

      for (const size of sizes) {
          const [w, h] = extractBaseSize(size).split('x');
          const zipData = zipSizes[size];
          const maxKB = getMaxFileSize(size);
          const maxDur = getMaxDuration(size);

          // Per-size optimization data
          let optData = { assets: [], overallReduction: 0, count: 0 };
          if (optimizeReport && optimizeReport.assets) {
              const prefix = size + '/images/';
              let totalBefore = 0, totalAfter = 0;
              for (const [key, val] of Object.entries(optimizeReport.assets)) {
                  if (key.startsWith(prefix)) {
                      const last = val.history[val.history.length - 1];
                      totalBefore += last.sizeBefore;
                      totalAfter += last.sizeAfter;
                      optData.assets.push({ name: key.replace(prefix, ''), reduction: last.reduction, sizeBefore: last.sizeBefore, sizeAfter: last.sizeAfter });
                      optData.count++;
                  }
              }
              optData.overallReduction = totalBefore > 0 ? Math.round((1 - totalAfter / totalBefore) * 100) : 0;
          }

          const detailData = {
              size, width: w, height: h,
              client: previousSettings.client || 'N/A',
              brand: previousSettings.brand || 'N/A',
              campaign: previousSettings.campaign || 'N/A',
              concept: previousSettings.concept || 'N/A',
              filesize: zipData ? zipData.formatted : 'N/A',
              filesizeBytes: zipData ? zipData.bytes : 0,
              maxFilesize: maxKB,
              maxDuration: maxDur,
              optimization: optData,
              testResults: testResults && testResults.banners && testResults.banners[size] || null,
              testTimestamp: testResults ? testResults.timestamp : null
          };

          const detailHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${size} — Banner Detail</title>
<style>
*{box-sizing:border-box;}body{margin:0;font-family:Arial,sans-serif;background:#1c1c1c;color:#ccc;display:flex;height:100vh;font-size:12px;}
.panel{width:350px;min-width:350px;background:#2c2c2c;padding:20px;overflow-y:auto;flex-shrink:0;}
.banner-area{flex:1;padding:20px;overflow:auto;background:#1c1c1c;}
.banner-area iframe{border:0;}
h3{color:white;margin:20px 0 8px 0;font-size:14px;border-bottom:1px solid #444;padding-bottom:6px;}
.stat{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #333;font-size:12px;}
.stat-label{color:#999;font-size:12px;}
.badge{display:inline-block;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:bold;background:#444;color:white;}
</style>
</head><body>
<div class="panel">
<div id="panel-content">Loading...</div>
</div>
<div class="banner-area">
<iframe src="../${size}/index.html" width="${w}" height="${h}"></iframe>
</div>
<script>
var __detailData = ${JSON.stringify(detailData)};
var __testResults = ${JSON.stringify(testResults)};
var __optimizeReport = ${JSON.stringify(optimizeReport)};
</script>
<script src="../preview-detail.js"></script>
</body></html>`;

          await fs.writeFile(join(detailDir, `${size}.html`), detailHtml);
      }

      // Copy assets to _temporal_preview folder
      await fs.copyFile(join(parentDirectory, 'assets', 'preview-styles.css'), join(previewPath, 'preview-styles.css'));
      await fs.copyFile(join(parentDirectory, 'assets', 'preview-script.js'), join(previewPath, 'preview-script.js'));
      await fs.copyFile(join(parentDirectory, 'assets', 'preview-detail.js'), join(previewPath, 'preview-detail.js'));

      if (!expressMode) {
          // No local server is needed in expressMode, since it just require to create the temporary folder to be uploaded immediately.
          const app = express();

          // SSE endpoint for hot reload (must be before static middleware)
          const sseClients = [];
          app.get('/__reload', (req, res) => {
              res.set({
                  'Content-Type': 'text/event-stream',
                  'Cache-Control': 'no-cache',
                  'Connection': 'keep-alive'
              });
              res.flushHeaders();
              sseClients.push(res);
              req.on('close', () => {
                  const idx = sseClients.indexOf(res);
                  if (idx !== -1) sseClients.splice(idx, 1);
              });
          });

          function notifyClients(bannerSize) {
              const data = JSON.stringify({ size: bannerSize });
              sseClients.forEach(client => client.write(`data: ${data}\n\n`));
          }

          app.use(express.static(previewPath));

          // Watch banner-sizes source folder for changes
          let debounceTimer = null;
          const watcher = chokidar.watch(latestVersionPath, {
              ignoreInitial: true,
              ignored: /(^|[\/\\])\./,
          });

          watcher.on('all', async (event, changedPath) => {
              const rel = relative(latestVersionPath, changedPath);

              // Sync changed file to _temporal_preview
              const destFile = join(previewPath, rel);
              try {
                  if (event === 'unlink' || event === 'unlinkDir') {
                      if (existsSync(destFile)) {
                          await fs.rm(destFile, { recursive: true });
                      }
                  } else if (existsSync(changedPath)) {
                      await fs.mkdir(dirname(destFile), { recursive: true });
                      const stat = statSync(changedPath);
                      if (stat.isFile()) {
                          await fs.copyFile(changedPath, destFile);
                      }
                  }
              } catch (err) {
                  // Silently skip copy errors
              }

              // Debounce rapid changes then notify browser to do a full reload
              clearTimeout(debounceTimer);
              debounceTimer = setTimeout(() => {
                  console.log(`\x1b[36m[hot-reload]\x1b[0m ${event}: ${rel}`);
                  notifyClients('__full__');
              }, 300);
          });

          app.listen(8000, () => {
              console.log('Server listening on http://localhost:8000');
              console.log('\x1b[36m[hot-reload]\x1b[0m Watching for changes...');
              open('http://localhost:8000');
          });
      }
  } catch (err) {
      console.error(`Error: ${err}`);
  }
}
