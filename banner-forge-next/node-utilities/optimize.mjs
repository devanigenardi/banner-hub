import tinify from 'tinify';
import sharp from 'sharp';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import fsp from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { SingleBar } from 'cli-progress';
import { global } from './_global.mjs';

dotenv.config();

tinify.key = process.env.TYNYPNG_API;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const parentFolder = path.resolve(__dirname, '..');
const reportPath = path.join(parentFolder, 'reports', 'optimize-report.json');

// Generate a hash of a file's contents to detect changes
async function hashFile(filePath) {
    const data = await fsp.readFile(filePath);
    return crypto.createHash('md5').update(data).digest('hex');
}

// Load existing report or create empty one
async function loadReport() {
    try {
        const data = await fsp.readFile(reportPath, 'utf8');
        return JSON.parse(data);
    } catch {
        return { assets: {} };
    }
}

// Save report
async function saveReport(report) {
    await fsp.mkdir(path.dirname(reportPath), { recursive: true });
    await fsp.writeFile(reportPath, JSON.stringify(report, null, 2));
}

async function optimizeImageWithTinyPNG(imagePath) {
    return new Promise((resolve, reject) => {
        const source = tinify.fromFile(imagePath);
        source.toFile(imagePath, (error) => {
            if (error) reject(error);
            else resolve('tinypng');
        });
    });
}

async function optimizeImageWithSharp(imagePath) {
    const tempFilePath = `${imagePath}.temp`;
    const extension = path.extname(imagePath).toLowerCase();
    let sharpInstance = sharp(imagePath);

    if (extension === '.jpg' || extension === '.jpeg') {
        sharpInstance = sharpInstance.jpeg({ quality: 80 });
    } else if (extension === '.png') {
        sharpInstance = sharpInstance.png({ quality: 80 });
    }

    await sharpInstance.toFile(tempFilePath);
    await fsp.unlink(imagePath);
    await fsp.rename(tempFilePath, imagePath);
    return 'sharp';
}

// Collect all images across all banner sizes
async function collectImages() {
    const bannerSizesFolder = path.join(parentFolder, global.rootDir);
    await global.getLatestVersionDir(bannerSizesFolder);

    const entries = fs.readdirSync(bannerSizesFolder, { withFileTypes: true })
        .filter(d => d.isDirectory() && /^\d+x\d+/.test(d.name));

    const images = [];
    for (const entry of entries) {
        const imagesFolder = path.join(bannerSizesFolder, entry.name, 'images');
        if (!fs.existsSync(imagesFolder)) continue;

        const files = fs.readdirSync(imagesFolder);
        for (const file of files) {
            const ext = path.extname(file).toLowerCase().slice(1);
            if (global.imgExtensions.includes(ext)) {
                images.push({
                    absolutePath: path.join(imagesFolder, file),
                    relativePath: path.join(entry.name, 'images', file)
                });
            }
        }
    }
    return images;
}

export async function optimizeImagesInSubfolders() {
    try {
        const report = await loadReport();
        const images = await collectImages();

        if (images.length === 0) {
            console.log(chalk.yellow.bold('No images found in banner-sizes/'));
            return;
        }

        // Classify images: new/changed vs already optimized
        const newImages = [];
        const optimizedImages = [];

        for (const img of images) {
            const currentHash = await hashFile(img.absolutePath);
            const record = report.assets[img.relativePath];

            if (!record || record.hash !== currentHash) {
                // New image or file changed since last optimization
                newImages.push({ ...img, currentHash });
            } else {
                optimizedImages.push({ ...img, passes: record.passes });
            }
        }

        // Show summary
        console.log(chalk.cyan.bold('\n  Optimization Summary\n'));
        console.log(chalk.white(`  Total images:     ${images.length}`));
        console.log(chalk.green(`  Already optimized: ${optimizedImages.length}`));
        console.log(chalk.yellow(`  New/changed:       ${newImages.length}`));

        if (optimizedImages.length > 0) {
            const maxPasses = Math.max(...optimizedImages.map(i => i.passes));
            const avgPasses = (optimizedImages.reduce((sum, i) => sum + i.passes, 0) / optimizedImages.length).toFixed(1);
            console.log(chalk.gray(`  Avg passes:        ${avgPasses} (max: ${maxPasses})`));
        }
        console.log('');

        let imagesToProcess = [];
        let mode = 'new';

        if (newImages.length === 0 && optimizedImages.length > 0) {
            // Everything already optimized
            const { action } = await inquirer.prompt([{
                type: 'list',
                name: 'action',
                message: 'All images are already optimized. What would you like to do?',
                choices: [
                    { name: 'Nothing — all good', value: 'skip' },
                    { name: 'Full optimize — re-process everything (adds another compression pass)', value: 'full' }
                ]
            }]);

            if (action === 'skip') {
                console.log(chalk.green.bold('\n  Nothing to optimize. All images are up to date.\n'));
                return;
            }
            mode = 'full';
            imagesToProcess = images.map(img => ({
                ...img,
                currentHash: null // will be computed after optimization
            }));
        } else if (newImages.length > 0) {
            const choices = [
                { name: `Optimize new/changed only (${newImages.length} images)`, value: 'new' }
            ];
            if (optimizedImages.length > 0) {
                choices.push({ name: `Full optimize — re-process all ${images.length} images`, value: 'full' });
            }

            if (choices.length === 1) {
                mode = 'new';
            } else {
                const { action } = await inquirer.prompt([{
                    type: 'list',
                    name: 'action',
                    message: 'How would you like to optimize?',
                    choices,
                    default: 'new'
                }]);
                mode = action;
            }

            if (mode === 'new') {
                imagesToProcess = newImages;
            } else {
                imagesToProcess = images.map(img => ({
                    ...img,
                    currentHash: null
                }));
            }
        }

        if (imagesToProcess.length === 0) return;

        console.log(chalk.green.bold(`\n  Starting ${mode === 'full' ? 'full' : 'incremental'} optimization (${imagesToProcess.length} images)...\n`));

        // Progress bar
        const progressBar = new SingleBar({
            format: `  {bar} {percentage}% | {value}/{total} | ${chalk.blue('{filename}')}`,
            hideCursor: true,
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            barsize: 30,
        });
        progressBar.start(imagesToProcess.length, 0, { filename: '' });

        let switchedToFallback = false;

        for (let i = 0; i < imagesToProcess.length; i++) {
            const img = imagesToProcess[i];
            const sizeBefore = (await fsp.stat(img.absolutePath)).size;

            progressBar.update(i, { filename: img.relativePath });

            let engine;
            try {
                engine = await optimizeImageWithTinyPNG(img.absolutePath);
            } catch (error) {
                if (error instanceof tinify.AccountError || (error.message && error.message.includes('429'))) {
                    if (!switchedToFallback) {
                        switchedToFallback = true;
                    }
                    engine = await optimizeImageWithSharp(img.absolutePath);
                } else {
                    throw error;
                }
            }

            const sizeAfter = (await fsp.stat(img.absolutePath)).size;
            const newHash = await hashFile(img.absolutePath);

            // Update report
            const existing = report.assets[img.relativePath] || { passes: 0, history: [] };
            existing.passes += 1;
            existing.hash = newHash;
            existing.lastOptimized = new Date().toISOString();
            existing.history.push({
                pass: existing.passes,
                engine,
                sizeBefore,
                sizeAfter,
                reduction: sizeBefore > 0 ? Math.round((1 - sizeAfter / sizeBefore) * 100) : 0,
                timestamp: new Date().toISOString()
            });
            report.assets[img.relativePath] = existing;

            progressBar.update(i + 1, { filename: img.relativePath });
        }

        progressBar.stop();

        // Save report
        report.lastRun = new Date().toISOString();
        report.mode = mode;
        await saveReport(report);

        // Print summary
        console.log(chalk.green.bold('\n  Optimization complete!\n'));

        if (switchedToFallback) {
            console.log(chalk.yellow('  Note: TinyPNG quota reached — some images were processed with Sharp (lossy fallback)\n'));
        }

        // Show per-image results
        let totalSaved = 0;
        for (const img of imagesToProcess) {
            const record = report.assets[img.relativePath];
            const lastPass = record.history[record.history.length - 1];
            const saved = lastPass.sizeBefore - lastPass.sizeAfter;
            totalSaved += saved;
        }

        const savedKB = (totalSaved / 1024).toFixed(1);
        console.log(chalk.white(`  Total saved: ${chalk.green.bold(savedKB + ' KB')} across ${imagesToProcess.length} images`));
        console.log(chalk.gray(`  Report saved to reports/optimize-report.json\n`));

    } catch (error) {
        console.error(chalk.red.bold('Error optimizing images:'));
        console.error(chalk.red(error));
    }
}

// Check optimization status — returns { total, optimized, unoptimized, unoptimizedList }
export async function checkOptimizationStatus() {
    const report = await loadReport();
    const images = await collectImages();

    let optimized = 0;
    let unoptimized = 0;
    const unoptimizedList = [];

    for (const img of images) {
        const currentHash = await hashFile(img.absolutePath);
        const record = report.assets[img.relativePath];

        if (record && record.hash === currentHash) {
            optimized++;
        } else {
            unoptimized++;
            unoptimizedList.push(img.relativePath);
        }
    }

    return {
        total: images.length,
        optimized,
        unoptimized,
        unoptimizedList
    };
}
