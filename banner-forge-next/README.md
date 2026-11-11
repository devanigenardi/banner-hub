# banner-forge v0.1

BannerForge utilities to easily create banners
Created by **Fabian Miranda** @ **Assemble Studio**

## Important!
This is not a framework! It is not going to force you to develop your banners using an specific technology, instead is a utilities pack that will help you to tackle repetitive tasks pretty easily

## Templates:

The idea behind BannerForge is to speed up:
- Resizing
- Images optimization
- Staging
- Packaging
  
That said, the creation of your Master size is manual, and it needs to be done in a  way that the banner and its different components can easily adapt based on canvas' dimension changes. Here you have some useful templates that will let you start a campaign based on its needs:

### GSAP based

- [gsap-banner-isi-template](https://github.com/assemble-web/gsap-banner-isi-template)

- [gsap-banner-template](https://github.com/assemble-web/gsap-banner-template)

### Animate CC based

- [animate-gsap-isi-banner](https://github.com/assemble-web/animate-gsap-isi-banner)

- [animate-vanilla-banner](https://github.com/assemble-web/animate-vanilla-banner)

##Getting Started with BannerForge

### Installing NodeJS
This app runs mostly on NodeJS 18.0, and some third party modules. To get it running well, please be sure about having installed NodeJs v18 or newer. If you have Node installed but you want to check its version, do:

```bash
node -v
```
However, if you don't, do this instead:
1. Go to https://nodejs.org/en
2. Click to download the LTS version
3. Once download it, install the package.

### Get & check full repository

Now, after being sure about get Node in your computer, the second thing to do is getting a copy of the full repository. If you are reading this, you probably have it already, and right next to this README file, you will also see:
- /assets (folder)
- /banner-sizes (folder)
- /node-utilities (folder)
- package.json (file)
- package-lock.json (file)

### Install dependencies

Browse in your terminal to the root of the local copy of the repository you just download (the one containing the previous files mentioned), and there, do:

```bash
npm install
```

This will install a bunch of third party modules, that are require for Banner Forge to work appropiately and being able to access the file system, compress and generate zips, etc.
Once the process is done, a **node_modules/** folder should be created in the root of your Banner Forge project.

And at this point you are ready to start!

## Starting to work

Now, you can start creating a Master banner within the **banner-sizes/** folder.

But before you start, let's explore the cool features of BannerForge:

### Automated resizing

BannerForge is capable to take your master and generate the resizes you need. Based on your master size, it will create copies according to the items you checked as part of the resizes list. But is not just a cloning tool, based on the folder name reflecting a size, it will modify the html (ad.size metatag) and the css file (main container and other elements), to reflect the required size for the banner, and if you are using a fluid/responsive container, and assets adapt accordingly, most of the work will be done.

Therefore, you just need to create the master, and you can delegate the resizing part to this Utility.

To start working on your master size, this is how your folder structure will look:

```
banner-sizes/
  300x250/    ← your master size
```

> **Note:** Version folders (`v1/`, `v2/`, etc.) inside `banner-sizes/` have been deprecated. Banner sizes must live directly inside `banner-sizes/`. All versioning is handled by git.

Once you have your Master size within the **banner-sizes/** folder (typically the 300x250), you can start testing this feature by typing:

```bash
npm run forge
```

You will be asked to:

#### 1. Provide basic info about your campaign. 

You will be prompted to provide:
- Client Name
- Brand Name
- Campaign Name
- Concept Name

Most of this info you can grab it from dropbox/jira.

Also, you will be asked to provide a "root" name to your batch and images. This is the name final packaged files will show on its name, next to its corresponding size. Therefore, if you set soemthing like "my-banners", your zip files will be named as: 
- my-banners_300x250.zip
- my-banners_160x600.zip
And so on...

#### 2. Confirm Master size.

As mentiond before, 300x250 is typically the master unit. But in case you ned to select a different option, here is where you can set that up. Just press ENTER once the desired option is selected.

#### 3. Declare required resizes.

You will be first asked about requiring resizes, choose NO and move forward with the process skipping this part. Or select YES and then use SPACE to check those sizes you require to be created. If resizes were maerked, those folders are immediately created on the same version folder, within banner-sizes/ folder, right next to the master size.


### TinyPNG optimization
The cool optimization offers in its website, is also here just by typinhg a simple command. The script will go through all of your master and resizes folders, will look for the images/ folder and optimize everything there (as long as is part of the approved list of formats: png, jpg, jpeg, gif)

To execute this, just type on the terminal:

```bash
npm run optimize
```

A loading bar will be shown in the terminal, wait for this progress bar to be completed.

### Generate ZIPS (Packaging)

You can also generate all the zips you need for your campaign. 

```bash
npm run package
```

BannerForge will create one zip per banner, and will use the name of the campaign previously entered during configuration (first run of `npm run forge`)

You will see a **published/** folder at he root of your project, and there your banners will be published, within a folder named with the date & time of the publication. **Be carefull about keeping unnecesary zippackages there, to avoid Disc Space unneded consumption**

### Previewing your banners locally (Preview)

You can check all your banners together into a single page, by typing:

```bash
npm run preview
```

This will create a local ***/_temporal_preview*** folder in your root folder, that will be served through a local https server. It is composed by a group of iframes that will upload your banners side by side.


### Staging your banners (Upload)

Once that you are ready to share your banners with the team or client. Instead of going to open a browser tab, navigate to a staging/previewing site, and manually dragging your zip files and setting up a campaign. You can instead simple type:

```bash
npm run upload
```

This feature will allow you to create 2 kind of staging links

This command stablish an SFTP connection to our staging server. Therefore you need to include your credentials (User & Password) in a `.env` file on your project's root folder. Like this:

```js
// FTP Credentials
FTP_USER=youruser
FTP_PASS=yourpassword
```

- **Permanent**: This type requires you to declare **client, brand, campaign, and concept**. And based on that data, it will upload your files in the corresponding server path.
Right after confirming your campaign details, it will then ask you to confirm the folder path you are about to create on the server, or confirming also that you want to replace the content of an existing one.

- **Temporal**: This kind of staging link, will only live one month on the server. It is mostly intended to share samples, or unfinished assets, for internal purposes. If you want to share something that will stay permanently live, avoid this and use **Permanent**

Whatever option you choose, the tool will show a progress bar, so once everything is up and ready, it will also automatically open a browser tab with the content.

The content that will be hosted live, is exactly the same you are able to preview locally. The script looks for the ***/_temporal_preview*** folder and push it via SFTP to the live server. Some cool extra features this staging has are:

 - #### adchoices Logo: 
    Allows you to display this well known requirement and positioning it accordingly on any corner of your banners. This saves the need to manually create "ad.choices versions" usually asked on legal reviews.

 - #### Download options:
    On the bottom-left, you will see a **[Download Options]** button, that opens up a popup with the full list of the available individual assets, but also a button to download a consolidated zip will all the units within. IMPORTANT: This feature only works on the online link for obvious reasons.


---

## Campaign Settings

BannerForge stores campaign configuration in `campaign-settings.json` at the root of your project. This file is created automatically during your first `npm run forge` run, but you can also edit it manually to configure advanced options.

### File Size Limits

By default, all banners are validated against a **200 KB** package limit. When previewing, banners that exceed their limit are flagged in red, and banners within the limit are shown in green.

To set a custom file size limit for specific sizes, add a `fileSizeLimits` property to your `campaign-settings.json`:

```json
{
  "master": "300x250",
  "batchName": "my-campaign",
  "client": "acme",
  "brand": "widgets",
  "campaign": "summer-2026",
  "concept": "default",
  "fileSizeLimits": {
    "300x600": 300,
    "970x250": 400
  }
}
```

Values are in **KB**. Any size not listed in `fileSizeLimits` will use the default 200 KB limit.

### Animation Duration Limits

By default, all banners are validated against a **15 second** animation duration limit. Same as file size, banners that exceed their limit are shown in red, and those within it in green.

To set a custom duration limit for specific sizes:

```json
{
  "durationLimits": {
    "300x600": 20,
    "970x250": 30
  }
}
```

Values are in **seconds**. Any size not listed in `durationLimits` will use the default 15s limit.

### Full Example

```json
{
  "master": "300x250",
  "batchName": "my-campaign",
  "client": "acme",
  "brand": "widgets",
  "campaign": "summer-2026",
  "concept": "default",
  "fileSizeLimits": {
    "300x600": 300,
    "970x250": 400
  },
  "durationLimits": {
    "300x600": 20
  }
}
```

## Preview Features

When running `npm run preview`, the preview UI provides several tools per banner:

- **Dimensions** - Shows the banner size
- **File Size** - Shows the ZIP package weight, colored green/red based on compliance with the limit
- **Animation Duration** - Detected automatically for GSAP, Animate CC, and GWD banners, colored green/red based on compliance
- **ClickTags** - Shows the number of clickTag variables detected, colored green if all have URLs assigned, red if any are undefined
- **Open in New Tab** - Opens a detailed view with a side panel showing all banner metadata: format (STD/RMDC), animation engine (GSAP/Animate CC/GWD/Unknown), file size, duration, and a full clickTag report including which DOM elements invoke each one
- **Hot Reload** - Changes to files in `banner-sizes/` are automatically detected and the preview reloads without restarting the server

### Banner Detection

BannerForge automatically detects:

| Property | Values | How it detects |
|----------|--------|---------------|
| Format | **STD** (Standard), **RMDC** (Rich Media DoubleClick) | Presence of `Enabler` or `studio` globals |
| Animation Engine | **GSAP**, **Animate CC**, **GWD**, **Unknown** | GSAP global, `lib.properties`, GWD meta generator tag / `gwd*` scripts / `.gwd-` CSS classes |
| ClickTags | `clickTag`, `clickTag1`, `clickTag2`, ... | `var`/`let`/`const`/`window.` declarations, `data-exit` attributes, `Enabler.exit()` calls |

---

Any bug, or question, please report it to dev@assemblestudio.com

**Have fun!**
