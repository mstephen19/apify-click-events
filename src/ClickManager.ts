import { PlaywrightCrawlerOptions } from 'apify';
import { BrowserContext, Page } from 'playwright';
import { BrowserPoolOptions } from 'browser-pool';

import { script } from './script';

import { ClickManagerOptions, MapClickCallback, Mode } from './types';

import { WHITELIST, BLACKLIST, COMMON_ADS } from './constants';
import { sleep } from 'apify/build/utils';

import { log } from './utils';

/**
 * Create a new instance to get started! Be sure to check the docs.
 */
export default class ClickManager implements ClickManagerOptions {
    readonly mode: Mode;
    readonly whitelist: string[];
    readonly blacklist: string[];
    readonly blockWindowClickListeners: 0 | 1 | 2;
    readonly blockWindowOpenMethod: boolean;
    readonly allowDebugger: boolean;
    readonly enableOnPagesIncluding: string[];
    readonly blockCommonAds: boolean;
    readonly optimize: boolean;
    readonly stopClickPropogation: boolean;

    constructor({
        mode = WHITELIST,
        whitelist = [],
        blacklist = [],
        blockWindowClickListeners = 2,
        blockWindowOpenMethod = false,
        allowDebugger = true,
        enableOnPagesIncluding = [],
        blockCommonAds = false,
        optimize = false,
        stopClickPropogation = true,
    }: ClickManagerOptions = {}) {
        if (!enableOnPagesIncluding?.length) console.log('No regular expressions provided in "enableOnPagesIncluding"!');
        if (mode && mode !== WHITELIST && mode !== BLACKLIST) throw new Error('Invalid mode!');
        if (
            (blockWindowClickListeners && blockWindowClickListeners > 2) ||
            blockWindowClickListeners < 0 ||
            typeof blockWindowClickListeners !== 'number'
        ) {
            throw new Error('blockWindowClickListeners must be a number 0-2!');
        }

        this.mode = mode || WHITELIST;
        this.whitelist = whitelist || [];
        this.blacklist = blacklist || [];
        this.blockWindowClickListeners = blockWindowClickListeners ?? 2;
        this.blockWindowOpenMethod = blockWindowOpenMethod ?? false;
        this.allowDebugger = allowDebugger ?? true;
        this.enableOnPagesIncluding = enableOnPagesIncluding || [];
        this.blockCommonAds = blockCommonAds ?? false;
        this.optimize = optimize ?? false;
        this.stopClickPropogation = stopClickPropogation ?? true;
        log('Initialized.');
    }

    /**
     * The magic.
     *
     * @returns An object to be spread within your crawler's configuration options
     *
     */
    injectScripts(): Partial<PlaywrightCrawlerOptions & BrowserPoolOptions> {
        return {
            browserPoolOptions: {
                //@ts-ignore
                postLaunchHooks: [
                    async (_, browserController) => {
                        const promises = [];

                        for (const browser of browserController.browser.contexts() as BrowserContext[]) {
                            const params = {
                                mode: this.mode,
                                whitelist: this.whitelist,
                                blacklist: this.blacklist,
                                blockWindowClickListeners: this.blockWindowClickListeners,
                                blockWindowOpenMethod: this.blockWindowOpenMethod,
                                allowDebugger: this.allowDebugger,
                                enableOnPagesIncluding: this.enableOnPagesIncluding,
                                stopClickPropogation: this.stopClickPropogation,
                            };

                            promises.push(
                                (async () => {
                                    await browser.addInitScript(script, params);

                                    if (this.blockCommonAds) {
                                        await browser.route(
                                            (url) => COMMON_ADS.some((s) => url.hostname.includes(s)),
                                            async (route) => {
                                                await route.abort();
                                            }
                                        );
                                    }

                                    if (this.optimize) {
                                        await browser.route('**/*.{css,jpg,jpeg,png,pdf,zip,svg,gif,woff}', async (route) => await route.abort());
                                    }
                                })()
                            );
                        }

                        await Promise.all(promises);
                    },
                ],
            },
        };
    }

    /**
     * Wait for the script to be injected before doing anything else.
     *
     * @param page PlayWright page
     * @param removeElement Whether or not to remove the ClickManager status element from the page (in case it's causing issues). Default false
     */
    static async waitForInject(page: Page, removeElement = false) {
        await page.waitForSelector('#clickManagerReady');

        if (removeElement) {
            await page.evaluate(() => {
                document.querySelector('#clickManagerReady').remove();
            });
        }

        log('Script injected.');
    }

    /**
     * Add to the page's whitelisted selectors to be able to click them
     *
     * @param page PlayWright page
     * @param selectors Array of selectors
     */
    static async addToWhiteList(page: Page, selectors: string[]) {
        await page.evaluate((selectors) => {
            //@ts-ignore
            window.whitelist = [...window?.whitelist, ...selectors];
            //@ts-ignore
            console.log('Current whitelist', window.whitelist);
        }, selectors);
        return sleep(700);
    }

    /**
     *
     * @param page PlayWright page
     * @param selector Selector to whitelist, then click
     * @param option 'PLAYWRIGHT' or 'BROWSER'. Defines how to run the click operation.
     */
    static async whiteListAndClick(page: Page, selector: string, option?: 'PLAYWRIGHT' | 'BROWSER') {
        await this.addToWhiteList(page, [selector]);

        if (!option || option === 'PLAYWRIGHT') return page.click(selector);
        //@ts-ignore
        return page.evaluate((selector) => document.querySelector(selector).click(), selector);
    }

    /**
     * Add to the page's blacklisted selectors to block the ability to click them
     *
     * @param page PlayWright page
     * @param selectors Array of selectors
     */
    static async addToBlackList(page: Page, selectors: string[]) {
        await page.evaluate((selectors) => {
            //@ts-ignore
            window.blacklist = [...window?.blacklist, ...selectors];
            //@ts-ignore
            console.log('Current blacklist', window.blacklist);
        }, selectors);
        return sleep(700);
    }

    /**
     * Get a list of all the currently whitelisted/blacklisted selectors
     *
     * @param page PlayWright page
     */
    static async checkLists(page: Page) {
        const lists = await page.evaluate(() => {
            //@ts-ignore
            if (window.clickManagerMode === 'WHITELIST') {
                return {
                    //@ts-ignore
                    whitelist: window.whitelist as string[],
                };
            }
            //@ts-ignore
            if (window.clickManagerMode === 'BLACKLIST') {
                return {
                    //@ts-ignore
                    blacklist: window.blacklist as string[],
                };
            }
        });

        log('Current lists:', lists);
        return lists;
    }

    /**
     *
     * @param page PlayWright page
     * @param selector Selector where multiple
     * @param func Callback to run after each element is clicked
     * @returns Array of the data you returned back.
     */
    static async mapClick(page: Page, selector: string, func: MapClickCallback): Promise<unknown[]> {
        const arr: unknown[] = [];

        const selectors = await page.$$(selector);

        for (const selector of selectors) {
            await selector.click();
            let data = null;

            try {
                data = await func(page);
                arr.push(data);
            } catch (err) {
                throw new Error(`Error when running callback: ${err}`);
            }
        }

        return arr;
    }

    /**
     *
     * @param page PlayWright page
     * @param selector
     */
    static async click(page: Page, selector: string) {
        try {
            await page.evaluate((selector) => {
                //@ts-ignore
                if (window.clickManagerMode === 'BLACKLIST') {
                    //@ts-ignore
                    const elems = [...window.blacklist.map((s: string) => document.querySelector(s))];

                    for (const elem of elems) {
                        if (elem.match(selector)) throw new Error("Can't click a blacklisted selector!");
                    }
                }

                //@ts-ignore
                if (window.clickManagerMode === 'WHITELIST') {
                    //@ts-ignore
                    const elems = [...window.whitelist.map((s: string) => document.querySelector(s))];

                    if (!elems.some((e: Element) => e.matches(selector))) throw new Error("Selector isn't on the whitelist!");
                }

                //@ts-ignore
                document.querySelector(selector).click();
            }, selector);
        } catch (err) {
            throw new Error(`Failed to click ${selector}: ${err}`);
        }
    }

    /**
     * Block the window.open method on just one page
     *
     * @param page PlayWright page
     */
    static async blockWindowOpenMethod(page: Page) {
        await page.evaluate(() => {
            //@ts-ignore
            window.open = function () {
                console.log('Page attempted to open new window with window.open');
            };
        });
    }

    /**
     *
     * @param page PlayWright page
     * @param selector Hidden selector to display on the page
     * @param classNames Extra class names to give the element other than the defaults of 'open active show'. Separate these by spaces
     */
    static async displayHiddenElement(page: Page, selector: string, classNames: string = '') {
        await page.evaluate(
            ({ selector, classNames }) => {
                const elem = document.querySelector(selector);
                elem.className += ` open active show ${classNames}`;
                //@ts-ignore
                elem.style.visibility = 'visible';
                //@ts-ignore
                elem.style.display = 'block';
            },
            { selector, classNames }
        );
    }
}
