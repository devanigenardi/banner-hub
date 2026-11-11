# Configuration

## Configuration files

### campaign-settings.json

Persists campaign configuration between runs. Created/updated automatically when running `npm run forge`.

```json
{
  "master": "300x250",
  "batchName": "assemble",
  "client": "assemble",
  "brand": "internal",
  "campaign": "bannerforge-testing",
  "concept": "default",
  "stagingLink": "https://bannerforge.assemblestudio.com/permanent-links/...",
  "serverPath": "/opt/bitnami/apache/htdocs/permanent-links/..."
}
```

| Field | Description |
|-------|-------------|
| master | Master banner size (default: 300x250) |
| batchName | Prefix for ZIP files |
| client | Client name |
| brand | Brand within client |
| campaign | Campaign name |
| concept | Creative concept |
| stagingLink | URL from last staging upload |
| serverPath | Server path from last upload |

### .env

Credentials that are NOT committed to the repo:

```
TYNYPNG_API=your_tinypng_api_key
FTP_USER=your_sftp_username
FTP_PASS=your_sftp_password
```

### .gitignore

```
node_modules
published/
_temporal_preview/
.env
```

Ignored folders:
- `published/` - Generated ZIPs (temporary output)
- `_temporal_preview/` - Generated preview (temporary output)
- `.env` - Credentials

## Constants in _global.mjs

### Banner sizes

```javascript
const sizes = [
  '300x250', '160x600', '300x600', '728x90',
  '970x250', '970x90', '480x320', '300x50', '320x50'
];
```

### Image extensions

```javascript
const imgExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg'];
```

### Versioning

Banners are organized in versioned folders (`v1/`, `v2/`, etc.) inside `banner-sizes/`. The `getLatestVersionDir()` function automatically detects the latest version.

## SFTP server

- **Host**: `bannerforge.assemblestudio.com`
- **Port**: 22 (default SSH)
- **Permanent base path**: `/opt/bitnami/apache/htdocs/permanent-links/`
- **Temporal base path**: `/opt/bitnami/apache/htdocs/temporary-links/`
- **Public URL**: `https://bannerforge.assemblestudio.com/[type]-links/...`
