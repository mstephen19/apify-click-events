import { PlaywrightCrawlerOptions } from 'apify';
import { Page } from '@playwright/test';
import { BrowserPoolOptions } from 'browser-pool';

import { script } from './script';

import { ClickManagerOptions, MapClickCallback, Mode } from './types';

import { WHITELIST, BLACKLIST } from './constants';
import { sleep } from 'apify/build/utils';

import { log } from './utils';

export default class ClickManager implements ClickManagerOptions {
    readonly mode: Mode;
    readonly whitelist: string[];
    readonly blacklist: string[];
    readonly blockWindowClickListeners: 0 | 1 | 2;
    readonly blockWindowOpenMethod: boolean;
    readonly allowDebugger: boolean;
    readonly enableOnPagesIncluding: RegExp[];

    constructor({
        mode = WHITELIST,
        whitelist = [],
        blacklist = [],
        blockWindowClickListeners = 2,
        blockWindowOpenMethod = false,
        allowDebugger = true,
        enableOnPagesIncluding = [],
    }: ClickManagerOptions) {
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
        log('Initialized.');
    }

    /**
     * The magic.
     * @returns An object to be spread within your crawler's configuration options
     *
     */
    injectScripts(): Partial<PlaywrightCrawlerOptions & BrowserPoolOptions> {
        return {
            browserPoolOptions: {
                //@ts-ignore
                postLaunchHooks: [
                    async (_, browserController) => {
                        for (const browser of browserController.browser.contexts()) {
                            const params = {
                                mode: this.mode,
                                whitelist: this.whitelist,
                                blacklist: this.blacklist,
                                blockWindowClickListeners: this.blockWindowClickListeners,
                                blockWindowOpenMethod: this.blockWindowOpenMethod,
                                allowDebugger: this.allowDebugger,
                                enableOnPagesIncluding: this.enableOnPagesIncluding,
                            };

                            await browser.addInitScript(script, params);
                        }
                    },
                ],
            },
        };
    }

    /**
     *
     * @param page PlayWright/Puppeteer page.
     * Wait for the script to be injected before doing anything else.
     */
    static async waitForInject(page: Page) {
        await page.waitForSelector('#clickManagerReady');
        log('Script injected.');
    }

    /**
     *
     * @param page PlayWright/Puppeteer page
     * @param selectors Array of selectors
     * Add to the page's whitelisted selectors to be able to click them
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
     * @param page PlayWright/Puppeteer page
     * @param selectors Array of selectors
     * Add to the page's blacklisted selectors to block the ability to click them
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
     * @param page PlayWright/Puppeteer page
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
     * @param page PlayWright/Puppeteer page
     * @param selector Selector where multiple
     * @param func Callback to run after each element is clicked
     * @returns Array of the data you returned back.
     */
    static async mapClick<T>(page: Page, selector: string, func: MapClickCallback): Promise<T[]> {
        const arr: T[] = [];

        const selectors = await page.$$(selector);
        for (const selector of selectors) {
            await selector.click();
            let data = null;

            try {
                data = await func<T>(page);
                arr.push(data);
            } catch (err) {
                throw new Error(`Error when running callback: ${err}`);
            }
        }

        return arr;
    }
}
