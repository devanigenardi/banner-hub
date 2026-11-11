# CLI Commands

## Summary

All commands run via npm scripts that internally call `forge.mjs` with an argument:

```bash
npm run forge      # Create resizes from master
npm run optimize   # Compress images
npm run package    # Generate ZIPs
npm run preview    # Local preview at localhost:8000
npm run upload     # Upload to staging via SFTP
```

---

## npm run forge

**What it does**: Takes the master banner (300x250) and generates adjusted copies for each selected size.

### Interactive flow

1. Asks for project data (client, brand, campaign, concept) — or uses saved values
2. Asks for the batch name for ZIPs
3. Confirms master size (default: 300x250)
4. Asks whether resizes are needed
5. If yes: shows size list for selection
6. If sizes already exist: asks whether to override or redo

### What it modifies per resize

- **HTML**: Updates `ad.size` meta tag with new dimensions
- **CSS**: Changes `width` and `height` of the main container
- **JS**: Regenerates `imagesArray` with files from the images/ folder

### Tag support

Folders can have tags after `_` (e.g., `300x250_dark`, `300x250_v2`). This allows multiple variants of the same size.

---

## npm run optimize

**What it does**: Compresses all images across all banner sizes.

### Compression pipeline

1. Tries TinyPNG first (better quality)
2. If TinyPNG returns HTTP 429 (quota exceeded), switches to Sharp
3. Sharp uses quality 80 (lossy)

### Supported extensions

jpg, jpeg, png, gif, svg

### Requirement

Environment variable `TYNYPNG_API` in `.env` with your TinyPNG API key (500 free compressions/month).

---

## npm run package

**What it does**: Creates one ZIP file per banner size.

### Output

```
published/
└── April 21 16h13m00s/
    ├── campaign-name_300x250.zip
    ├── campaign-name_160x600.zip
    ├── campaign-name_728x90.zip
    └── ...
```

- Compression level 9 (maximum)
- Configurable prefix via batch name
- Date and time in folder name

---

## npm run preview

**What it does**: Generates a local preview with all banners in an iframe grid.

### What it generates

- `_temporal_preview/` folder with banner copies
- HTML page with iframe grid
- Express server on `localhost:8000`
- Auto-opens browser

### Preview features

- Checkboxes to show/hide sizes
- Per-banner refresh button
- AdChoices logo positioning (4 corners)
- ZIP download links (if packaging was run)
- Visible campaign metadata

---

## npm run upload

**What it does**: Uploads banners to a staging server via SFTP.

### Two modes

#### Permanent
- Path: `/permanent-links/[client]/[brand]/[campaign]/[concept]/`
- URL: `https://bannerforge.assemblestudio.com/permanent-links/...`
- Never expires

#### Temporal
- Path: `/temporary-links/[random-id]_[timestamp]/`
- URL: `https://bannerforge.assemblestudio.com/temporary-links/...`
- Expires in ~1 month

### Requirements

Environment variables in `.env`:
```
FTP_USER=your_username
FTP_PASS=your_password
```

### Features
- Progress bar during upload
- Reuses settings from previous session
- Opens staging link in browser when done
- Copies ZIPs to `_temporal_preview/downloads/` for preview download
