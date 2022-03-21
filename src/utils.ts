import { color } from 'console-log-colors';

const { bold, green } = color;

export const log = (str: string, ...rest) => {
    console.log(bold(green('[ClickManager] ')), str, ...rest);
};
