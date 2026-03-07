/**
 * Plugin version - injected at build time via esbuild define
 * __VERSION__ is always defined by build.js
 * @handbook 8.3-dist-commit
 */
declare const __VERSION__: string;
export const VERSION: string = __VERSION__;
