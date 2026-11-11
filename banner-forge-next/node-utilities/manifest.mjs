import fs from 'fs/promises';
import { existsSync, readdirSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { global } from './_global.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const parentDirectory = resolve(__dirname, '..');

function extractBaseSize(size) {
    const match = size.match(/^\d+x\d+/);
    return match ? match[0] : null;
}

function formatFileSize(bytes) {
    if (!bytes) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMaxFileSize(size) {
    const settings = global.loadCampaignSettings();
    if (settings && settings.fileSizeLimits && settings.fileSizeLimits[size]) {
        return settings.fileSizeLimits[size];
    }
    return global.defaultMaxFileSize;
}

function getMaxDuration(size) {
    const settings = global.loadCampaignSettings();
    if (settings && settings.durationLimits && settings.durationLimits[size]) {
        return settings.durationLimits[size];
    }
    return global.defaultMaxDuration;
}

export async function generateManifest(previewPath) {
    const settings = global.loadCampaignSettings();
    const pkg = JSON.parse(await fs.readFile(join(parentDirectory, 'package.json'), 'utf8'));

    // Get sizes from preview folder
    const entries = readdirSync(previewPath, { withFileTypes: true });
    const sizeFolders = entries
        .filter(e => e.isDirectory() && /^\d+x\d+/.test(e.name))
        .map(e => e.name)
        .filter(name => global.sizes.includes(extractBaseSize(name)));

    // Read ZIP filesizes from downloads folder
    const downloadsPath = join(previewPath, 'downloads');
    const downloads = [];
    const zipSizes = {};

    if (existsSync(downloadsPath)) {
        const files = readdirSync(downloadsPath).filter(f => f.endsWith('.zip'));
        for (const file of files) {
            const filePath = join(downloadsPath, file);
            const stats = statSync(filePath);
            downloads.push({ filename: file, size: stats.size });

            const sizeMatch = file.match(/(\d+x\d+(?:_[^.]*)?)/);
            if (sizeMatch) {
                zipSizes[sizeMatch[1]] = { bytes: stats.size, formatted: formatFileSize(stats.size) };
            }
        }
    }

    // Read optimization report
    let optimizeReport = null;
    const optPath = join(parentDirectory, 'reports', 'optimize-report.json');
    try {
        if (existsSync(optPath)) {
            optimizeReport = JSON.parse(await fs.readFile(optPath, 'utf8'));
        }
    } catch (e) {}

    // Read test results
    let testResults = null;
    const testPath = join(parentDirectory, 'reports', 'test-results.json');
    try {
        if (existsSync(testPath)) {
            testResults = JSON.parse(await fs.readFile(testPath, 'utf8'));
        }
    } catch (e) {}

    // Build per-size data
    const sizes = sizeFolders.map(folder => {
        const [w, h] = extractBaseSize(folder).split('x');
        const zip = zipSizes[folder];
        const maxFS = getMaxFileSize(folder);
        const maxDur = getMaxDuration(folder);

        // Optimization data for this size
        let optimization = { count: 0, overallReduction: 0, assets: [] };
        if (optimizeReport && optimizeReport.assets) {
            const prefix = folder + '/images/';
            let totalBefore = 0, totalAfter = 0;
            for (const [key, val] of Object.entries(optimizeReport.assets)) {
                if (key.startsWith(prefix)) {
                    const last = val.history[val.history.length - 1];
                    totalBefore += last.sizeBefore;
                    totalAfter += last.sizeAfter;
                    optimization.assets.push({
                        name: key.replace(prefix, ''),
                        reduction: last.reduction,
                        sizeBefore: last.sizeBefore,
                        sizeAfter: last.sizeAfter
                    });
                    optimization.count++;
                }
            }
            optimization.overallReduction = totalBefore > 0 ? Math.round((1 - totalAfter / totalBefore) * 100) : 0;
        }

        return {
            folder,
            baseSize: extractBaseSize(folder),
            width: parseInt(w),
            height: parseInt(h),
            filesize: zip ? zip.formatted : null,
            filesizeBytes: zip ? zip.bytes : 0,
            maxFilesize: maxFS,
            maxDuration: maxDur,
            optimization,
            testResults: testResults && testResults.banners && testResults.banners[folder] || null
        };
    });

    const manifest = {
        version: pkg.version,
        generatedAt: new Date().toISOString(),
        campaign: {
            client: settings.client || 'Unknown',
            brand: settings.brand || 'Unknown',
            campaign: settings.campaign || 'Unknown',
            concept: settings.concept || 'Unknown'
        },
        sizes,
        testTimestamp: testResults ? testResults.timestamp : null,
        downloads: downloads.map(d => ({ filename: d.filename }))
    };

    // Write manifest to preview folder
    const manifestPath = join(previewPath, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    return manifest;
}
