import { Page } from 'playwright';

export type Mode = 'WHITELIST' | 'BLACKLIST';

/**
 * In whitelist mode, only selectors which you specify can be clicked. In blacklist mode, all selectors except the ones specified can be clicked.
 */
export interface ClickManagerOptions {
    mode?: Mode;
    whitelist?: string[];
    blacklist?: string[];
    blockWindowClickListeners?: 0 | 1 | 2;
    blockWindowOpenMethod?: boolean;
    allowDebugger?: boolean;
    enableOnPagesIncluding?: string[];
    blockCommonAds?: boolean;
    optimize?: boolean;
    stopClickPropogation?: boolean;
}

export type MapClickCallback = (page: Page) => Promise<unknown>;
