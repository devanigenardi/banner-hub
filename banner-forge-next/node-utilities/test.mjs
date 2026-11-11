import { chromium } from 'playwright';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import chalk from 'chalk';
import { global } from './_global.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const parentDirectory = resolve(__dirname, '..');
const resultsFile = join(parentDirectory, 'reports', 'test-results.json');

// Script injected BEFORE banner loads to intercept click mechanisms
const interceptScript = `
(function() {
    // Spy on window.open
    window.__clickTagCalls = [];
    const originalOpen = window.open;
    window.open = function(url) {
        window.__clickTagCalls.push({ url: url, timestamp: Date.now() });
        // Don't actually open — just record
    };

    // Spy on addEventListener to track which elements get click listeners
    window.__clickListeners = [];
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, fn, options) {
        if (type === 'click' && this instanceof HTMLElement) {
            var id = this.id ? '#' + this.id : '';
            var cls = this.className ? '.' + String(this.className).split(' ').join('.') : '';
            var tag = this.tagName ? this.tagName.toLowerCase() : '';
            window.__clickListeners.push({
                selector: tag + id + cls,
                element: this
            });
        }
        return originalAddEventListener.call(this, type, fn, options);
    };

    // Mock Enabler for RMDC banners
    if (typeof window.Enabler === 'undefined') {
        window.__enablerExits = [];
        window.Enabler = {
            exit: function(name, url) {
                window.__clickTagCalls.push({ url: url || name, exitName: name, timestamp: Date.now() });
            },
            isInitialized: function() { return true; },
            isPageLoaded: function() { return true; },
            isVisible: function() { return true; },
            addEventListener: function() {},
            loadModule: function() {},
            setProfileId: function() {},
            setStartExpanded: function() {}
        };
    }
})();
`;

// Detect all clickable elements and their associated clickTags
const detectionScript = `
(function() {
    var result = { clickTags: [], clickableElements: [] };

    // Collect clickTag variables
    var clickTagPattern = /^clickTag\\d*$/;
    for (var key in window) {
        try {
            if (clickTagPattern.test(key)) {
                var val = window[key];
                result.clickTags.push({
                    name: key,
                    value: (val !== undefined && val !== null) ? String(val) : undefined
                });
            }
        } catch(e) {}
    }

    // Try let/const declarations
    ['clickTag', 'clickTag1', 'clickTag2', 'clickTag3', 'clickTag4', 'clickTag5'].forEach(function(name) {
        var found = result.clickTags.some(function(ct) { return ct.name === name; });
        if (!found) {
            try {
                var val = eval('typeof ' + name + ' !== "undefined" ? ' + name + ' : undefined');
                if (val !== undefined) {
                    result.clickTags.push({ name: name, value: String(val) });
                }
            } catch(e) {}
        }
    });

    // Collect clickable elements from multiple sources:

    // 1. data-exit attributes
    document.querySelectorAll('[data-exit]').forEach(function(el) {
        var id = el.id ? '#' + el.id : '';
        var cls = el.className ? '.' + String(el.className).split(' ').join('.') : '';
        var tag = el.tagName.toLowerCase();
        result.clickableElements.push({
            selector: tag + id + cls,
            method: 'data-exit',
            exitName: el.getAttribute('data-exit'),
            cssSelector: el.id ? '#' + el.id : (el.className ? '.' + String(el.className).split(' ')[0] : tag)
        });
    });

    // 2. onclick attributes
    document.querySelectorAll('[onclick]').forEach(function(el) {
        var id = el.id ? '#' + el.id : '';
        var cls = el.className ? '.' + String(el.className).split(' ').join('.') : '';
        var tag = el.tagName.toLowerCase();
        var onclickText = el.getAttribute('onclick') || '';
        // Try to extract clickTag reference
        var ctMatch = onclickText.match(/clickTag\\d*/);
        result.clickableElements.push({
            selector: tag + id + cls,
            method: 'onclick',
            exitName: ctMatch ? ctMatch[0] : null,
            cssSelector: el.id ? '#' + el.id : (el.className ? '.' + String(el.className).split(' ')[0] : tag)
        });
    });

    // 3. JS-added click listeners (tracked by our interceptor)
    if (window.__clickListeners) {
        window.__clickListeners.forEach(function(entry) {
            // Avoid duplicates with data-exit elements
            var isDuplicate = result.clickableElements.some(function(ce) {
                return ce.selector === entry.selector;
            });
            if (!isDuplicate) {
                var el = entry.element;
                result.clickableElements.push({
                    selector: entry.selector,
                    method: 'addEventListener',
                    exitName: null,
                    cssSelector: el.id ? '#' + el.id : (el.className ? '.' + String(el.className).split(' ')[0] : el.tagName.toLowerCase())
                });
            }
        });
    }

    return result;
})();
`;

async function findBannerSizes() {
    const bannerDir = join(parentDirectory, 'banner-sizes');
    await global.getLatestVersionDir(bannerDir);
    const entries = await fs.readdir(bannerDir);
    return entries.filter(e => /^\d+x\d+(?:_.*)?$/.test(e));
}

export async function testClickTags() {
    console.log(chalk.cyan.bold('\n  ClickTag Testing\n'));

    const sizes = await findBannerSizes();
    if (sizes.length === 0) {
        console.log(chalk.red('  No banner sizes found in banner-sizes/'));
        return false;
    }

    // Start a local server to serve banners
    const app = express();
    app.use(express.static(join(parentDirectory, 'banner-sizes')));
    const server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;

    const browser = await chromium.launch({ headless: true });
    const results = {};
    let allPassed = true;

    for (const size of sizes) {
        const indexPath = join(parentDirectory, 'banner-sizes', size, 'index.html');
        if (!existsSync(indexPath)) {
            console.log(chalk.yellow(`  ${size}: no index.html found, skipping`));
            continue;
        }

        console.log(chalk.white(`  Testing ${chalk.bold(size)}...`));

        const context = await browser.newContext();
        const page = await context.newPage();

        // Inject interceptors before page loads
        await page.addInitScript(interceptScript);

        // Navigate to banner
        await page.goto(`http://localhost:${port}/${size}/index.html`, {
            waitUntil: 'load',
            timeout: 15000
        });

        // Wait for banner scripts to initialize
        await page.waitForTimeout(2000);

        // Detect clickTags and clickable elements
        const detection = await page.evaluate(detectionScript);

        const sizeResults = {
            size: size,
            clickTags: detection.clickTags,
            clickableElements: detection.clickableElements,
            tests: [],
            timestamp: new Date().toISOString()
        };

        if (detection.clickableElements.length === 0) {
            console.log(chalk.yellow(`    No clickable elements detected`));
            sizeResults.tests.push({
                status: 'warning',
                message: 'No clickable elements detected'
            });
        }

        // Test each clickable element
        for (const element of detection.clickableElements) {
            // Clear previous calls
            await page.evaluate(() => { window.__clickTagCalls = []; });

            // Click the element
            try {
                await page.click(element.cssSelector, { timeout: 3000 });
            } catch (e) {
                sizeResults.tests.push({
                    element: element.selector,
                    method: element.method,
                    exitName: element.exitName,
                    status: 'error',
                    message: 'Could not click element: ' + e.message
                });
                console.log(chalk.red(`    ✗ ${element.selector} — could not click`));
                allPassed = false;
                continue;
            }

            // Small wait for handler execution
            await page.waitForTimeout(200);

            // Check if window.open was called
            const calls = await page.evaluate(() => window.__clickTagCalls);

            if (calls.length > 0) {
                const lastCall = calls[calls.length - 1];
                const expectedTag = element.exitName;
                const expectedUrl = expectedTag
                    ? detection.clickTags.find(ct => ct.name === expectedTag)?.value
                    : null;

                const urlFired = lastCall.url;
                const matched = expectedUrl ? urlFired === expectedUrl : true;

                sizeResults.tests.push({
                    element: element.selector,
                    method: element.method,
                    exitName: element.exitName,
                    status: matched ? 'pass' : 'fail',
                    expectedUrl: expectedUrl || 'N/A',
                    firedUrl: urlFired
                });

                if (matched) {
                    console.log(chalk.green(`    ✓ ${element.selector} → ${urlFired}`));
                } else {
                    console.log(chalk.red(`    ✗ ${element.selector} — expected ${expectedUrl}, got ${urlFired}`));
                    allPassed = false;
                }
            } else {
                sizeResults.tests.push({
                    element: element.selector,
                    method: element.method,
                    exitName: element.exitName,
                    status: 'fail',
                    message: 'Click did not trigger window.open'
                });
                console.log(chalk.red(`    ✗ ${element.selector} — no window.open triggered`));
                allPassed = false;
            }
        }

        results[size] = sizeResults;
        await context.close();
    }

    await browser.close();
    server.close();

    // Write results to JSON
    const output = {
        timestamp: new Date().toISOString(),
        allPassed: allPassed,
        banners: results
    };

    await fs.writeFile(resultsFile, JSON.stringify(output, null, 2));
    console.log(chalk.cyan(`\n  Results saved to ${chalk.bold('reports/test-results.json')}`));

    if (allPassed) {
        console.log(chalk.green.bold('\n  All clickTag tests passed ✓\n'));
    } else {
        console.log(chalk.red.bold('\n  Some clickTag tests failed ✗\n'));
    }

    return allPassed;
}
