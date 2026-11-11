import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import { join } from 'path';



export const global = {

    /***  CONFIGURABLE CONST VALUES ***/
    sizes: ['300x250', '160x600', '300x600', '728x90', '970x250', '970x90', '480x320', '300x50', '320x50'],
    imgExtensions: ['jpg', 'jpeg', 'png', 'gif', 'svg'],
    defaultMaxFileSize: 200,  // KB
    defaultMaxDuration: 15,   // seconds
    rootDir: 'banner-sizes',
    settingsFile: 'campaign-settings.json',
    /*** Global methods ***/
    

    getLatestVersionDir: async function(rootDir) {
        const dir = rootDir || global.rootDir;
        const entries = await fs.promises.readdir(dir);
        const versionFolders = entries.filter(e => e.startsWith('v') && !isNaN(e.slice(1)));

        if (versionFolders.length > 0) {
            console.error('\n\x1b[31m' +
                '╔════════════════════════════════════════════════════════╗\n' +
                '║  ERROR: Version folders (v1/, v2/, ...) detected      ║\n' +
                '║  in banner-sizes/.                                    ║\n' +
                '║                                                       ║\n' +
                '║  This practice has been deprecated.                   ║\n' +
                '║  Place your banner size folders directly inside       ║\n' +
                '║  banner-sizes/ (e.g. banner-sizes/300x250/).          ║\n' +
                '║                                                       ║\n' +
                '║  Versioning is now handled entirely by git.           ║\n' +
                '╚════════════════════════════════════════════════════════╝\x1b[0m\n');
            process.exit(1);
        }

        // No version folder needed — banner sizes live directly in banner-sizes/
        return '';
    },

    getCurrentSizes: async function() {
        const versionDir = await this.getLatestVersionDir(this.rootDir);
        const sizesDir = versionDir ? `${this.rootDir}/${versionDir}` : this.rootDir;
        const allSizes = await fs.promises.readdir(sizesDir);
        const master = this.loadCampaignSettings().master;

        return allSizes.filter(size => size !== master && fs.statSync(path.join(sizesDir, size)).isDirectory());
    },

    loadCampaignSettings: function() {
        if (fs.existsSync(global.settingsFile)) {
            return JSON.parse(fs.readFileSync(global.settingsFile));
        }
        return null;
    },

    saveCampaignSettings: function (newSettings) {
        // Load existing settings
        let currentSettings = {};
        if (fs.existsSync(global.settingsFile)) {
            currentSettings = JSON.parse(fs.readFileSync(global.settingsFile, 'utf8'));
        }
        // Merge existing settings with new settings. New settings will overwrite existing ones if they have the same property.
        const combinedSettings = { ...currentSettings, ...newSettings };
        // Save merged settings back to file
        fs.writeFileSync(global.settingsFile, JSON.stringify(combinedSettings, null, 2), 'utf8');
    },  

    sanitizeInput: function(input) {
        return input.toLowerCase().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
    },
    
    askProjectData: async function(){

        const previousData = this.loadCampaignSettings();        

        const client = this.sanitizeInput(await inquirer.prompt({ 
            type: 'input', 
            name: 'input', 
            message: 'Enter CLIENT: ',
            default: previousData && previousData.client ? previousData.client : null
        }).then(a => a.input));
        
        const brand = this.sanitizeInput(await inquirer.prompt({ 
            type: 'input', 
            name: 'input', 
            message: 'Enter BRAND: ',
            default: previousData && previousData.brand ? previousData.brand : null
        }).then(a => a.input));
       
        const campaign = this.sanitizeInput(await inquirer.prompt({ 
            type: 'input', 
            name: 'input', 
            message: 'Enter CAMPAIGN: ',
            default: previousData && previousData.campaign ? previousData.campaign : null
        }).then(a => a.input));
        
        const concept = this.sanitizeInput(await inquirer.prompt({
            type: 'input', 
            name: 'input', 
            message: 'Enter CONCEPT: ',
            default: previousData && previousData.concept ? previousData.concept : "Default"
        }).then(a => a.input));

        return {client, brand, campaign, concept}
    },

    countFiles: async function(dir) {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        let fileCount = 0;
    
        for (let entry of entries) {
            const entryPath = join(dir, entry.name);
            entry.isDirectory() ? fileCount += await this.countFiles(entryPath) : fileCount++;
        }
        return fileCount;
    }
    
}