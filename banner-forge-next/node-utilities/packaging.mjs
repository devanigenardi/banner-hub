import fs from 'fs';
import { createWriteStream, mkdirSync, readdir, stat, promises as fsPromises } from 'fs';
import { fileURLToPath } from 'url';
import { resolve, join, dirname } from 'path';
import archiver from 'archiver';
import chalk from 'chalk';
import { global } from './_global.mjs';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const parentDirectory = resolve(__dirname, '..');
const tempFolderName = 'published';

const filterHiddenFiles = (fileName) => {
  return !fileName.startsWith('.');
};

// Get current date and time in ISO-sortable format
const getDateTime = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}_${hours}.${minutes}.${seconds}`;
};

export async function packaging() {
  try {
    const latestVersionDir = await global.getLatestVersionDir();
    const versionPath = join(parentDirectory, global.rootDir, latestVersionDir);

    const entries = await fs.promises.readdir(versionPath);

    // Clean published/ folder before creating new packages
    const publishedDir = join(parentDirectory, tempFolderName);
    try {
      await fs.promises.rm(publishedDir, { recursive: true });
    } catch (err) {
      // Ignore if the folder doesn't exist yet
      if (err.code !== 'ENOENT') throw err;
    }

    const currentDateTime = getDateTime();
    const tempFolderPath = join(parentDirectory, tempFolderName, currentDateTime);
    mkdirSync(tempFolderPath, { recursive: true });

    const promises = entries.map(async entry => {
      const entryPath = join(versionPath, entry);

      try {
        const stats = await fs.promises.stat(entryPath);

        if (stats.isDirectory() && filterHiddenFiles(entry)) {
          
          const batchName = global.loadCampaignSettings().batchName 
            ? global.loadCampaignSettings().batchName.replace(/ /g, "_")
            : 'default'

          const zipName = batchName.length > 0 ? `${batchName}_${entry}` : entry;
          const outputFilePath = join(tempFolderPath, `${zipName}.zip`);

          return new Promise((resolve, reject) => {
            const output = createWriteStream(outputFilePath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => {
              console.log(`${chalk.green.bold(currentDateTime + '/' + zipName + '.zip')} has been published.`);
              resolve();
            });
            archive.on('error', err => reject(err));

            archive.pipe(output);
            archive.glob('**/*', { cwd: entryPath, dot: false }); // avoid hidden files in subfolders
            archive.finalize();
          });
        }
      } catch (err) {
        console.error(`Error reading entry ${entry}: ${err}`);
        throw err;
      }
    });

    await Promise.all(promises);
    return tempFolderPath;
  } catch (err) {
    console.error(`Error in packaging process: ${err}`);
    throw err; // This will allow the caller to catch the error
  }
}