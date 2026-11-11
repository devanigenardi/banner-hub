import fs from 'fs';
import cheerio from 'cheerio';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ncp from 'ncp';
import path from 'path';
import { promisify } from 'util';
import { global } from './_global.mjs';

import { optimizeImagesInSubfolders, checkOptimizationStatus } from './optimize.mjs';
import { packaging } from './packaging.mjs';
import { preview } from './preview.mjs';
import { upload } from './upload.mjs';
import { testClickTags } from './test.mjs';

const ncpPromised = promisify(ncp.ncp);
const latestVersionDir = await global.getLatestVersionDir(global.rootDir);
const sizePath = (size) => path.join(global.rootDir, latestVersionDir, size);
let existingSizes;

async function updateBannerScripts(size) {
    
    const files = await fs.promises.readdir(sizePath(size) + "/images/");
    let imagesArray = [];

    files.forEach((file) => {
        let ext = path.extname(file).slice(1);
        if (global.imgExtensions.includes(ext)) {
            imagesArray.push(file);
        } else {
            console.warn(chalk.yellow(`ATTENTION: The file named ${file} was excluded | Format Not Allowed`));
        }
    });

    let data = await fs.promises.readFile(path.join(sizePath(size), "js/banner-scripts.js"), 'utf8');
    const updatedData = data.replace(/let imagesArray = \[.*?\];/gs, `let imagesArray = ${JSON.stringify(imagesArray)};`);
    await fs.promises.writeFile(path.join(sizePath(size), "js/banner-scripts.js"), updatedData, 'utf8');
}

async function copyAndResize(master, size) {

    await ncpPromised(sizePath(master), sizePath(size));
    const currentSizeFolder = sizePath(size);
    const [width, height] = size.split('x');
    const metaContent = `width=${width},height=${height}`;

    let data = await fs.promises.readFile(`${currentSizeFolder}/index.html`, 'utf8');
    const $ = cheerio.load(data);
    
    // HTML(ad.size metatag) WIDTH and HEIGHT update
    let adsize = $('meta[name="ad.size"]');
    if(adsize.length > 0){
        adsize.attr('content', metaContent);
        const updatedData = $.html();
        await fs.promises.writeFile(`${currentSizeFolder}/index.html`, updatedData, 'utf8');
    }else{
        console.warn(chalk.yellow(`ATTENTION: ad.size metatag wasn't found on Master size`));
    }


    // CSS WIDTH and HEIGHT updates
    data = await fs.promises.readFile(`${currentSizeFolder}/css/styles.css`, 'utf8');
    const updatedWrapper = data.replace(/(#banner-wrapper\s*{\s*[^}]*?width:\s*)[\d\.]*px;([^}]*?height:\s*)[\d\.]*px;/gs, `$1${width}px;$2${height}px;`);
    const updatedPreloader = updatedWrapper.replace(/(#preloader\s*{\s*[^}]*?width:\s*)[\d\.]*px;([^}]*?height:\s*)[\d\.]*px;/gs, `$1${width}px;$2${height}px;`);
    await fs.promises.writeFile(`${currentSizeFolder}/css/styles.css`, updatedPreloader, 'utf8');
    
    // Then update banner scripts for each size
    await updateBannerScripts(size);
}

async function resizeBanners(master, selectedSizes, override=false) {
    for (const size of selectedSizes) {
        if (!fs.existsSync(sizePath(size))) {
            // If size doesn't exist, create it from the master.
            await fs.promises.mkdir(sizePath(size), { recursive: true });
            await copyAndResize(master, size);
        } else {
            if (override) {
                // If override is true, copy and resize even if it already exists.
                await copyAndResize(master, size);
            } else {
                // If size exists and we're not overriding, just update the scripts.
                await updateBannerScripts(size);
            }
        }
    }
}

async function main() {
    const previousSettings = global.loadCampaignSettings();
    let master, selectedSizes = [], createdOrOverwrittenSizes = [];

    //Intro banner-forge
    if(!fs.existsSync(global.settingsFile)){
        console.log(chalk.red(`
        ******** BANNER-FORGE (v0.1) *********
        **** "One Tool to rule them all" *****
        ****** Assemble Studios - 2023 *******
        **************************************
        `))
    }

    if (previousSettings) {

        console.log(global.getCurrentSizes())

        console.log(chalk.bold(`
        ${chalk.yellow('ATTENTION!')}
        The following configuration was previously created:
        - Batch name: ${chalk.green(previousSettings.batchName)}
        - Master size: ${chalk.green(previousSettings.master)}
        - Resizes: ${chalk.blue( await global.getCurrentSizes() )}
        `));

        const { continuePrevious } = await inquirer.prompt([{
            type: 'list',
            name: 'continuePrevious',
            message: 'Do you want to continue with this?',
            choices: [
                chalk.green('YES, Lets continue as is'), 
                chalk.red('NO, Let me do a new selection and create from scratch')
            ]
        }]);

        if (continuePrevious.includes('YES')) {
            master = previousSettings.master;
            selectedSizes = await global.getCurrentSizes();
            await resizeBanners(master, selectedSizes);
            console.log(chalk.green('Got it! All existing banners were updated accordingly'));
            return;
        }
    }

    let batchNameDefault = previousSettings ? previousSettings.batchName : '';

    const projectData = await global.askProjectData();

    const { batchName } = await inquirer.prompt([{
        type: 'input',
        name: 'batchName',
        message: 'Would you like to give a "root" name to this batch (it will be applied to zip packages):',
        default: batchNameDefault,
    }]);
    
    ({ master } = await inquirer.prompt([{
        type: 'list',
        name: 'master',
        message: 'Please confirm the master size among the following sizes:',
        choices: global.sizes,
    }]));
    await updateBannerScripts(master);

    let resizesRequired;

    ({ resizesRequired } = await inquirer.prompt([{
        type: 'list',
        name: 'resizesRequired',
        message: 'Are resizes being required?',
        choices: ['NO', 'YES'],
    }]));

    if (resizesRequired === 'NO') {
        // If resizes are not required, just exit the main function
        console.log(chalk.green('No resizes required.'));

    }else{

        let redoSelection;
        do {
            redoSelection = false;
            ({ selectedSizes } = await inquirer.prompt([{
                type: 'checkbox',
                name: 'selectedSizes',
                message: 'Please select multiple sizes from the above list:',
                choices: global.sizes.filter(size => size !== master),
                validate: function(input) {
                    if (input.length < 1) {
                        return 'You must choose at least one resize to create.';
                    }
                    return true;
                }
            }]));
            
            existingSizes = selectedSizes.filter(size => fs.existsSync(sizePath(size)));
            createdOrOverwrittenSizes = selectedSizes.filter(size => !fs.existsSync(sizePath(size)));
            
            if (existingSizes.length > 0) {
                console.log(chalk.yellow(`The following sizes already exist: ${existingSizes.join(', ')}.`));
                const { overrideOrRedo } = await inquirer.prompt([{
                    type: 'list',
                    name: 'overrideOrRedo',
                    message: 'Do you want to overwrite them or redo the selection?',
                    choices: [
                        chalk.green('Override them'), 
                        chalk.red('Redo the selection')
                    ]
                }]);
                if (overrideOrRedo.includes('Redo')) {
                    redoSelection = true;
                }
            }
        } while (redoSelection);

        await resizeBanners(master, selectedSizes, existingSizes.length > 0);
        // Feedback to the user
        console.log(chalk.green(`Done! The following sizes were ${existingSizes.length > 0 ? 'overwritten or ' : ''}created: ${createdOrOverwrittenSizes.join(', ')}`));
    }
    
    // Finally, save the settings for the next run.
    global.saveCampaignSettings({master, batchName, ...projectData});
}

// Actions

const command = process.argv[2];

switch(command){
    case 'forge': 
        main().catch(console.error); 
    break;
    case 'optimize': 
        optimizeImagesInSubfolders(); 
    break;
    case 'packaging': 
        packaging(); 
    break;
    case 'preview': 
        preview(); 
    break;
    case 'test':
        testClickTags();
    break;
    case 'upload':
        (async () => {
            // 1. Check optimization status (warning, non-blocking)
            const optStatus = await checkOptimizationStatus();
            if (optStatus.unoptimized > 0) {
                console.log(chalk.yellow.bold(`\n  ⚠ ${optStatus.unoptimized} of ${optStatus.total} images have not been optimized.\n`));
                const { proceed } = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'proceed',
                    message: 'Continue without optimizing?',
                    default: false
                }]);
                if (!proceed) {
                    console.log(chalk.cyan('\nRun `npm run optimize` first, then try again.\n'));
                    process.exit(0);
                }
            } else if (optStatus.total > 0) {
                console.log(chalk.green(`\n  ✓ All ${optStatus.total} images optimized.\n`));
            }

            // 2. Run clickTag tests (blocking)
            console.log(chalk.cyan('Running clickTag tests before upload...\n'));
            const passed = await testClickTags();
            if (!passed) {
                console.log(chalk.red.bold('Upload blocked: clickTag tests must pass before uploading.'));
                console.log(chalk.yellow('Fix the issues above and try again.\n'));
                process.exit(1);
            }

            // 3. Upload
            upload();
        })();
    break;
}