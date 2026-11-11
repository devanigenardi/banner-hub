# BannerForge - Overview

## What it is

BannerForge is a Node.js CLI utility suite for automating digital advertising banner production. It's not a framework — it's a developer tool that eliminates repetitive work from the banner production workflow.

Created by Fabian Miranda at Assemble Studio.

**Repo**: https://github.com/assemble-web/banner-forge

## What it does

Automates the full banner production cycle:

1. **Forge** - Takes a master banner (300x250) and automatically generates all other sizes
2. **Optimize** - Compresses images via TinyPNG (with Sharp fallback)
3. **Package** - Creates individual ZIP files per banner size
4. **Preview** - Spins up a local server to preview all banners
5. **Upload** - Deploys to staging server via SFTP

## Typical workflow

```
npm run forge     →  Create resizes from master
npm run optimize  →  Compress images
npm run preview   →  Review locally at localhost:8000
npm run package   →  Generate ZIPs for delivery
npm run upload    →  Push to staging for client QA
```

## Tech Stack

- **Runtime**: Node.js v18+ with ES Modules (.mjs)
- **HTML Parsing**: Cheerio
- **Images**: TinyPNG API + Sharp (fallback)
- **ZIP**: Archiver
- **Preview Server**: Express.js
- **SFTP**: ssh2-sftp-client
- **CLI**: Inquirer.js + Chalk

## Supported sizes

| Size | Common use |
|------|-----------|
| 300x250 | Medium Rectangle (Master) |
| 160x600 | Wide Skyscraper |
| 300x600 | Half Page |
| 728x90 | Leaderboard |
| 970x250 | Billboard |
| 970x90 | Super Leaderboard |
| 480x320 | Mobile Interstitial |
| 300x50 | Mobile Banner |
| 320x50 | Mobile Leaderboard |
