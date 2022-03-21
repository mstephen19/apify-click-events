# ClickManager

[![TypeScript](https://badges.frapsoft.com/typescript/love/typescript.svg?v=101)](https://github.com/ellerbrock/typescript-badges/)

![npm](https://img.shields.io/npm/v/apify-click-events?style=plastic)

## Table of Contents

- [Installation](#installation)
- [Importing](#importing)
- [About](#about)
- [Usage](#usage)
    - [`new ClickManager(options)`](#new-clickmanageroptions)
    - [Injecting the script using `injectScripts()`](#injecting-the-script-using-injectscripts)
    - [`await ClickManager.waitForInject(page)`](#await-clickmanagerwaitforinjectpage)
    - [`await ClickManager.addToWhiteList(page, selectors)`](#await-clickmanageraddtowhitelistpage-selectors)
    - [`await ClickManager.addToBlackList(page, selectors)`](#await-clickmanageraddtoblacklistpage-selectors)
    - [`await ClickManager.checkLists(page)`](#await-clickmanagerchecklistspage)
- [Utilities](#utilities)
    - [`await ClickManager.mapClick(page, selector, callback)`](#await-clickmanagermapclickpage-selector-callback)
    - [`await ClickManager.whiteListAndClick(page, selector)`](#await-clickmanagerwhitelistandclickpage-selector)
    - [`await ClickManager.click(page, selector)`](#await-clickmanagerclickpage-selector)
    - [`await ClickManager.blockWindowOpenMethod(page)`](#await-clickmanagerblockwindowopenmethodpage)

## Installation

```
npm i apify-click-events
```

## Importing

ES6+
```TypeScript
import { ClickManager } from 'apify-click-events';
```

ES5-
```JavaScript
const { ClickManager } = require('apify-click-events');
```

## About

When scraping a website, though it's not ideal, sometimes you just have to automate clicking the page. The issue is that too many sites have click traps which open up ads, new tabs, or do certain actions which you don't want when an element is clicked. This can be a result of an event listener on the window object, or the propogation of the click event on the target element.

With this package, easily whitelist/blacklist elements matching certain selectors to ensure the reliability of your actor's clicks, and to eliminate any errors/retries related to being redirected to another page, triggering an unwanted event, or not being able to click an element.

## Usage

### `new ClickManager(options)`

| Name   | Type | Default       | Description                                                         |
| ------ | ---- | ------------- | ------------------------------------------------------------------- |
| `mode` | Mode | `'WHITELIST'` | The mode of the ClickManager. Either `'WHITELIST'` or `'BLACKLIST'` |
| `whitelist` | string[] | `[]` | Selectors to whitelist on every page ClickManager is used. Page-specific selectors can be added to just one page load using the `addToWhiteList()` method. |
| `blacklist` | string[] | `[]` | Selectors to blacklist on every page. Page-specific selectors can be blacklisted using `addToBlackList()` |
| `blockWindowClickListeners` | number _(0, 1, or 2)_ | `2` | The intensity of blocking of window click listeners. `0` - no blocking. `2` - will only be fired if a whitelisted/non-blacklisted selector is clicked. `3` - no click related listeners will even be added to the window. |
| `blockWindowOpenMethod` | boolean | `false` | Whether or not to prevent the `window.open` method from firing. |
| `allowDebugger` | boolean | `true` | Sets the `window.debugger` to `null`, which is usually enough to bypass DevTools blocks. |
| `enableOnPagesIncluding` | string[] | `[]` | **REQUIRED:** Provide an array of strings. Any links matching any of the strings will get the ClickManager script injected into them. The `blockCommonAds` and `optimize` options still apply to all pages that go through the crawler. |
| `blockCommonAds` | boolean | `false` | Automatically block any requests the browser makes which matches a pre-made list of common ad providers. |
| `optimize` | boolean | `false` | Automatically block requests for any unnecessary resources such as CSS, images, and gifs. |

> `whitelist` and `blacklist` expect regular CSS selectors. Special selectors exclusively supported in PlayWright will not be valid.

**Usage:**

```JavaScript
const clickManager = new ClickManager({ whitelist: ['div.button-red'], blockWindowClickListeners: 1, enableOnPagesIncluding: ['*'] })
```

> **Note:** If you want to use ClickManager on all pages, just use `'*'` within your `enableOnPagesIncluding` array. It will match everything.

### Injecting the script using `injectScripts()`

Within your main file, first instantiate an instance of the ClickManager class with your custom options, then spread the return value of its `injectScripts()` method into your crawler's configuration.

```JavaScript
// Import "modes" as well to avoid typos
const { ClickManager, modes } = require('apify-click-events');

Apify.main(async () => {
    // Instantiate the class with your custom optionsr
    const clickManager = new ClickManager({
        mode: modes.BLACKLIST,
        blacklist: ['#accept-choices'],
        blockWindowOpenMethod: true,
        enableOnPagesIncluding: ['w3schools'],
    });

    const requestList = await Apify.openRequestList('start-urls', [
        { url: 'https://w3schools.com' },
    ]);

    const crawler = new Apify.PlaywrightCrawler({
        // injectScripts returns crawler options. Spread it out
        ...clickManager.injectScripts(),
        requestList,
        launchContext: {
            launcher: firefox,
        },
        handlePageFunction: async ({ page }) => {
            await ClickManager.waitForInject(page);

            ...
        },
    });

    await crawler.run();
});
```

### `await ClickManager.waitForInject(page)`

(**page**: _Page_) => `Promise<void>`

Waits for ClickManager's script to be injected, then logs a confirmation once it's been loaded. This will throw an error if the page's `window.location.url` doesn't match any of the `enableOnPagesIncluding` strings.

### `await ClickManager.addToWhiteList(page, selectors)`

(**page**: _Page_, **selectors**: string[]) => `Promise<void>`

Add page-specific selectors to the whitelist. This will do absolutely nothing if `'BLACKLIST'` mode is being used.

### `await ClickManager.addToBlackList(page, selectors)`

(**page**: _Page_, **selectors**: string[]) => `Promise<void>`

Add page-specific selectors to the blacklist. This will do absolutely nothing if `'WHITELIST'` mode is being used.

> **Note:** When you add a selector using `addToWhiteList` or `addToBlackList`, it is only added to the page, and will not be whitelisted/blacklisted on other pages. The only selectors which are added to the list for every single page are the static ones which you define within _ClickManagerOptions_

### `await ClickManager.checkLists(page)`

(**page**: _Page_) => `Record<string, string[]>`

Returns the currently whitelisted/blacklisted selectors for the certain page.

## Utilities

### `await ClickManager.mapClick(page, selector, callback)`

(**page**: _Page_, **selector**: _string_, **callback**: _MapClickCallback_) => `unknown[]`

Super useful when you need to click multiple elements that match the same selector, then collect some data after each click (perhaps due to content dynamically changing on the page).

The callback function takes the _Page_ as a parameter (post-click), and expects some value to be returned from it. Once all the selectors have been looped through and clicked, the results will be returned as an array.

```TypeScript
export type MapClickCallback = <T>(page: Page) => Promise<T>;
```

**Usage:**

```JavaScript
const arr = await ClickManager.mapClick(page, 'a.button', async (pg) => {
    const tabTitle = await pg.$('div#tab_title');
    const title = await tabTitle.textContent();
    return title;
});

console.log(arr); // array of all the tab titles
```

### `await ClickManager.whiteListAndClick(page, selector)`

(**page**: _Page_, **selector**: _string_) => `Promise<unknown[]>`

Whitelist a selector on the page, and then click it.

### `await ClickManager.click(page, selector)`

(**page**: _Page_, **selector**: _string_) => `Promise<void>`

Different from the PlayWright `page.click()` function. Checks the whitelist/blacklist for whether or not the selector can even be clicked, then clicks it, or throws an error.

### `await ClickManager.blockWindowOpenMethod(page)`

(**page**: _Page_) => `Promise<void>`

Rather than blocking `window.open` on all pages, you can set `blockWindowOpenMethod` in _ClickManagerOptions_ to `false`, and use this method on a page prior to doing any clicks that might result in `window.open` being called.