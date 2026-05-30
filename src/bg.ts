// MV3 service worker entry. importScripts is available in worker scope.
declare function importScripts(...urls: string[]): void;

try {
    importScripts("js/mybg.js");
} catch (e) {
    console.error(e);
}
