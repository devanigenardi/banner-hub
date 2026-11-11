# Assessment - Current state and improvement opportunities

## What's working well

1. **Clear modularity**: Each command has its own file, with a central hub in `_global.mjs`
2. **Smart persistence**: `campaign-settings.json` avoids re-typing data between runs
3. **Dual image pipeline**: TinyPNG with Sharp fallback is a solid strategy
4. **Tag support**: Folders with `_suffix` allow multiple variants of the same size
5. **Functional preview**: The local server with iframes and controls is practical
6. **Integrated SFTP**: Two modes (permanent/temporal) cover the use cases well

## Things to improve

### Code quality

- **package.json**: The `name` field is "test" — should be "banner-forge" or "@assemble/banner-forge"
- **Missing CLI entry**: `bin.bannerforge` points to `./cli.mjs` which doesn't exist
- **Unused dependencies**: `gm` and `imagemagick` are in dependencies but not imported anywhere
- **Empty jsconfig.json**: Either configure it or remove it
- **Typo in .env key**: `TYNYPNG_API` should be `TINYPNG_API`
- **Typo in upload.mjs**: Path says `/opt/bibnami/` instead of `/opt/bitnami/` (temporal links)
- **No input validation**: User data is sanitized but not validated (length, valid characters, etc.)
- **Fragile CSS regex**: Resize uses regex to find and replace CSS dimensions, which can break with unexpected formats

### Architecture

- **Monolithic entry point**: `forge.mjs` acts as both router AND forge logic — should be separated
- **Inconsistent error handling**: Some errors are caught, others aren't. No uniform pattern
- **No structured logging**: Uses raw `console.log` with chalk. A centralized logger would be better
- **Hardcoded paths**: SFTP server paths are hardcoded in the source
- **No tests**: Zero unit or integration tests
- **No CI/CD**: No automated pipeline
- **No linting**: No ESLint or Prettier configured

### Functionality

- **No watch mode**: No hot-reload for banner development
- **No weight validation**: Doesn't verify banners meet weight limits (typically 150KB)
- **No local GSAP support**: GSAP loads from CDN, which can fail without internet
- **No screenshot generation**: No automated way to generate static previews
- **No visual diff**: Can't visually compare a resize against the master
- **Preview doesn't support HTTPS**: HTTP only, which can cause mixed content issues with assets

### DX (Developer Experience)

- **No --help**: Commands have no inline documentation
- **No verbose mode**: No way to see detailed logs of what's happening
- **No dry-run**: Can't preview what a command would do without executing it
- **No undo**: If a resize goes wrong, you have to manually delete and redo

## Suggested priorities

### Quick wins (low effort, high impact)

1. Fix the name in package.json
2. Remove unused dependencies (gm, imagemagick)
3. Fix typos (TYNYPNG_API, bibnami)
4. Remove or configure jsconfig.json
5. Add banner weight validation after packaging

### Medium improvements

6. Separate the router from forge.mjs into a proper cli.mjs
7. Add ESLint + Prettier
8. Implement a centralized logger
9. Add --help to each command
10. Watch mode for development

### Large improvements

11. Test suite (at least for _global.mjs and forge.mjs)
12. CI/CD with GitHub Actions
13. Output validation (weight, dimensions, structure)
14. Plugin system for different banner types
15. Web GUI as CLI alternative
