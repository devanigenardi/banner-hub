import inquirer from 'inquirer';
import sftpClient from 'ssh2-sftp-client';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import { global } from './_global.mjs';
import * as ProgressBar from 'cli-progress';
import open from 'open';
import { customAlphabet } from 'nanoid';
import chalk from 'chalk';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { preview } from './preview.mjs';
import { packaging } from './packaging.mjs';
import { generateManifest } from './manifest.mjs';

dotenv.config();

const previewFolder = resolve('./_temporal_preview');
const serverPath = '/opt/bitnami/apache/htdocs';
const domain = 'https://bannerforge.assemblestudio.com';
const temporaryFolder = 'temporary-links';
const permanentFolder = 'permanent-links';
let stagingLink;

const nanoid = customAlphabet('1234567890abcdef', 5);

async function uploadDir(client, localDir, remoteDir, progressBar) {
    const entries = await fs.readdir(localDir, { withFileTypes: true });

    for (let entry of entries) {
        const localPath = join(localDir, entry.name);
        const remotePath = join(remoteDir, entry.name);

        if (entry.isDirectory()) {
            await client.mkdir(remotePath, true);
            await uploadDir(client, localPath, remotePath, progressBar);
        } else {
            await client.put(localPath, remotePath);
            progressBar.increment();
        }
    }
}

async function chooseUploadType() {
    const questions = [{
        type: 'list',
        name: 'stagingType',
        message: 'Choose the type of link to create:',
        choices: ['Permanent', 'Temporal'],
    }];

    const answers = await inquirer.prompt(questions);
    return answers.stagingType;
}

async function confirmPathToUpload() {
    const answers = await inquirer.prompt([{
        type: 'list',
        name: 'confirmation',
        message: `You are about to create the following directory: \n${chalk.bold.blue(stagingLink)}\n\n Is this correct?`,
        choices: ['YES', 'NO'],
    }]);

    return answers.confirmation;
}

async function confirmOverwrite() {
    const answers = await inquirer.prompt([{
        type: 'list',
        name: 'confirmation',
        message: chalk.yellow('The proposed path already exists on the server. Do you want to replace?'),
        choices: ['YES', 'NO'],
    }]);
    return answers.confirmation === 'YES';
}

async function setDownloadLinks() {
    // Create up-to-date packages and get the created folder path directly
    const sourceDir = await packaging();

    const destDir = join(previewFolder, 'downloads');

    // Check if destination directory exists; if not, create it (including any necessary parent directories)
    try {
        await fs.access(destDir);
    } catch (err) {
        await fs.mkdir(destDir, { recursive: true });
    }
    // Get all ZIP files from the source directory
    const files = (await fs.readdir(sourceDir)).filter(file => file.endsWith('.zip'));

    // Copy ZIP files to the destination directory
    for (const file of files) {
        await fs.copyFile(join(sourceDir, file), join(destDir, file));
    }

    // Create download links in preview

    const links = files.map((file, index) => {
        return `<li>
                    <a class="zip-package" href="./downloads/${file}?v=${nanoid()}" download>
                        <i class="fa-solid fa-download"></i>
                        ${file}
                    </a>
                </li>`;
    }).join('\n');

    const parentDirectory = resolve( dirname( fileURLToPath(import.meta.url) ), '..' );
    const originalHTML = await fs.readFile(join(parentDirectory, '_temporal_preview', 'index.html'), 'utf8');
    const updatedHTML = originalHTML.replace('{downloadLinks}', links)
    const previewPath = join(parentDirectory, '_temporal_preview');
    const filePath = join(previewPath, 'index.html');
    await fs.writeFile(filePath, updatedHTML);
}

// Function to extract base size (000x000) from the folder name
function extractBaseSize(size) {
  const match = size.match(/^\d+x\d+/);
  return match ? match[0] : null;
}

export async function upload() {

    // Open SFTP Connection

    const client = new sftpClient();

    console.log(`${chalk.bold.green('Forge -> Upload')}\nConnecting to SFTP Server...`)
    
    try {
        // Check if credentials are available in the .env file
        if (!process.env.FTP_USER || !process.env.FTP_PASS) {
          throw new Error('Credentials missing from .env file');
        }
      
        // Conect
        await client.connect({
          host: "bannerforge.assemblestudio.com",
          port: 22,
          username: process.env.FTP_USER,
          password: process.env.FTP_PASS
        });

        try {
            const stagingType = await chooseUploadType();
            const previousSettings = global.loadCampaignSettings();
            let reusePreviousSettings = false;
            let newDir;
    
            if (  stagingType !== "Temporal" && 
                  previousSettings && previousSettings.stagingLink && previousSettings.serverPath) {
    
                console.log(chalk.italic.yellow(`
                ${chalk.bold(`ATTENTION!`)} Previous uploading data was found:
                - Previous Staging link: ${chalk.bgYellow(previousSettings.stagingLink)}
                - Client: ${chalk.bgYellow(previousSettings.client)}
                - Brand: ${chalk.bgYellow(previousSettings.brand)}
                - Campaign: ${chalk.bgYellow(previousSettings.campaign)}
                - Concept: ${chalk.bgYellow(previousSettings.concept)}
                `));
        
                const replaceExistingContent = await inquirer.prompt({
                    type: 'list',
                    name: 'confirmation',
                    message: 'Do you want to use this pre-existing configuration?',
                    choices: [chalk.red.bold('NO'), chalk.green.bold('YES')],
                });
        
                if (replaceExistingContent.confirmation.includes('YES')) {
                    reusePreviousSettings = true;
                    newDir = previousSettings.serverPath;
                    stagingLink = previousSettings.stagingLink;
                }
            }
    
            
    
            if (!reusePreviousSettings) {
                if (stagingType === 'Permanent') {
    
                    const projectData = await global.askProjectData();
        
                    newDir = join(serverPath, permanentFolder, projectData.client, projectData.brand, projectData.campaign, projectData.concept);
                    stagingLink = `${domain}/${permanentFolder}/${projectData.client}/${projectData.brand}/${projectData.campaign}/${projectData.concept}`;
    
                    global.saveCampaignSettings({
                        client: projectData.client,
                        brand: projectData.brand,
                        campaign: projectData.campaign,
                        concept: projectData.concept,
                        stagingLink: stagingLink,
                        serverPath: newDir
                    });
        
    
                } else {
                    const date = new Date();
                    const id = customAlphabet('1234567890abcdef', 10);
                    const tempDirName = `${id}_${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}.${date.getMinutes().toString().padStart(2, '0')}.${date.getSeconds().toString().padStart(2, '0')}`;

                    newDir = join(serverPath, temporaryFolder, tempDirName);
                    stagingLink = `${domain}/${temporaryFolder}/${tempDirName}?v=${id}`;
                }
            }
    
            try {
                await fs.access(previewFolder);
                // If _temporal_preview folder exists, delete it
                console.log(`${chalk.bold('_temporal_preview')} folder exists. Deleting it before recreating.`);
                await fs.rm(previewFolder, { recursive: true });
            } catch (err) {
                console.log(`${chalk.bold('_temporal_preview')} folder didn't exist.`);
            }
            // Create the folder again, whether it existed before or not
            console.log('Creating from scratch _temporal_preview folder locally, before uploading to staging server.');
            await preview(true);
                        
    
            await fs.access(join(previewFolder, 'index.html'));

            const sizes = await fs.readdir(previewFolder);

            // Extract base sizes for comparison
            const baseSizes = sizes.map(size => extractBaseSize(size));

            const sizesExist = baseSizes.some(baseSize => global.sizes.includes(baseSize));
    
            if (!sizesExist) {
                throw new Error('No size folders exist in _temporal_preview');
            }

            // Prepare the downloads folder with ZIP files
            await setDownloadLinks(previewFolder);

            // Generate manifest.json for the centralized app
            console.log('Generating manifest.json...');
            await generateManifest(previewFolder);

            // Remove previous remote staging directory if exist
            const dirExists = await client.exists(newDir);
    
            if (dirExists) {
                const overwrite = await confirmOverwrite();

                if (!overwrite) {
                    console.log('Operation was cancelled by User.');
                    await client.end();
                    return;
                } else {
                    console.log('Cleaning up previous files on staging ...');
                    await client.rmdir(newDir, true);
                }
            }else{
                if(stagingType !== "Temporal"){
                    const confirm = await confirmPathToUpload();

                    if (confirm === 'NO') {
                        console.log('Operation was cancelled by User.');
                        return;
                    }
                }
            }
    
            await client.mkdir(newDir, true);
    
            const totalFiles = await global.countFiles(previewFolder);
            const progressBar = new ProgressBar.SingleBar({}, ProgressBar.Presets.shades_classic);
            progressBar.start(totalFiles, 0);
    
            await uploadDir(client, previewFolder, newDir, progressBar);
    
            progressBar.stop();
    
            console.log(chalk.green.bold(`\nStaging link: ${stagingLink}\n`));

            open(stagingLink+'?v='+nanoid());
    
        } catch (err) {
            console.error(chalk.red(`Error: ${err.message}`));

        } finally {
            // Remove the downloads directory after uploading
            const downloadsDir = join(previewFolder, 'downloads');
            await fs.rm(downloadsDir, { recursive: true });            
            await client.end();
        }
      
    }catch (error) {
        if (error.message.includes('Credentials missing from .env file')) {
          console.error( chalk.yellow('Error: FTP username and password must be provided in the .env file.\n') );
        } else if (error.code === 'ENOTFOUND') {
          console.error(chalk.yellow('Error: Could not find the specified host.\n'));
        } else if (error.message.includes('All configured authentication methods failed')) {
          console.error(chalk.yellow('Error: Incorrect username or password.\n'));
        } else {
          console.error(chalk.yellow(chalk.yellow('An unexpected error occurred:'), error.message + '\n'));
        }
        return;
    }     
}
