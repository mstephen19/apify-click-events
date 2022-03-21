import { Page } from '@playwright/test';

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
    enableOnPagesIncluding?: RegExp[];
}

export type MapClickCallback = <T>(page: Page) => Promise<T>;
