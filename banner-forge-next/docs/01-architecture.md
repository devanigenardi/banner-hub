# Architecture

## Project structure

```
banner-forge/
├── node-utilities/              # Core - CLI modules
│   ├── _global.mjs             # Shared config and utilities
│   ├── forge.mjs               # Entry point + resize logic
│   ├── optimize.mjs            # Image compression
│   ├── packaging.mjs           # ZIP creation
│   ├── preview.mjs             # Local preview server
│   └── upload.mjs              # SFTP staging upload
│
├── banner-sizes/                # Templates and generated banners
│   └── v1/                     # Versioned (v1, v2, etc.)
│       └── 300x250/            # Master template
│           ├── index.html
│           ├── css/
│           │   ├── styles.css
│           │   └── isi.css
│           ├── js/
│           │   └── banner-scripts.js
│           └── images/
│
├── assets/                      # Preview UI assets
│   ├── preview-template.html
│   ├── preview-styles.css
│   └── preview-script.js
│
├── campaign-settings.json       # Persisted campaign config
├── package.json
└── .env                         # Credentials (not committed)
```

## Data flow

```
                    campaign-settings.json
                           │
                           ▼
    forge.mjs ──────► _global.mjs ◄──── .env
        │                  │
        ▼                  ▼
  banner-sizes/v1/    Shared utilities
   ├── 300x250/       (paths, settings,
   ├── 160x600/        sanitize, etc.)
   ├── 728x90/
   └── ...
        │
        ├──► optimize.mjs ──► Images compressed in-place
        │
        ├──► packaging.mjs ──► published/[DateTime]/*.zip
        │
        ├──► preview.mjs ──► _temporal_preview/ + Express :8000
        │
        └──► upload.mjs ──► SFTP to bannerforge.assemblestudio.com
```

## Modules and responsibilities

### _global.mjs (Central hub)
- Defines constants: sizes, image extensions
- Resolves paths: `getLatestVersionDir()`, `getCurrentSizes()`
- Persists config: `loadCampaignSettings()`, `saveCampaignSettings()`
- Sanitizes input: lowercase, hyphenate, remove special chars
- Interactive prompts: `askProjectData()`

### forge.mjs (Entry point)
- Single entry point: receives command as CLI argument
- Switch that routes to: forge, optimize, packaging, preview, upload
- Resize logic:
  - Copies master to each size folder
  - Updates `ad.size` meta tag in HTML (via Cheerio)
  - Updates CSS dimensions via regex
  - Regenerates image array in banner-scripts.js

### optimize.mjs
- Dual pipeline: TinyPNG (primary) → Sharp (fallback)
- Detects HTTP 429 (quota exceeded) and switches automatically
- Processes all extensions: jpg, jpeg, png, gif, svg
- Progress bar with filename display

### packaging.mjs
- Creates `published/[DateTime]/` folder
- One ZIP per size with batch name prefix
- Compression level 9 via Archiver

### preview.mjs
- Generates `_temporal_preview/` by copying banners
- Injects iframe grid into HTML template
- Supports tags after `_` in folder names (e.g., `300x250_v2`)
- Express server on port 8000
- Auto-opens browser

### upload.mjs (Most complex, 306 lines)
- Two staging modes:
  - **Permanent**: `/permanent-links/[client]/[brand]/[campaign]/[concept]/`
  - **Temporal**: `/temporary-links/[random-id]_[timestamp]/` (expires in ~1 month)
- Reuses settings from previous session
- Progress bar during upload
- Generates download links in preview
- Opens staging link in browser when done

## Key dependencies

| Dependency | Purpose |
|-----------|---------|
| cheerio | Parse and modify banner HTML |
| sharp | Image compression (fallback) |
| tinify | TinyPNG API |
| archiver | Create ZIPs |
| express | Preview server |
| ssh2-sftp-client | SFTP upload |
| inquirer | Interactive CLI prompts |
| chalk | Terminal colors |
| ncp | Recursive folder copy |
| open | Open URLs in browser |
| cli-progress | Progress bars |
| nanoid | Short unique IDs |
| dotenv | Environment variables |
