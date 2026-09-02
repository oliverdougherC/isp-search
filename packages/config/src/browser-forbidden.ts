/**
 * This entry is what browser bundlers resolve when they follow the `browser` export
 * condition for a server-only subpath. Importing it is always a mistake: the real module
 * handles secrets or raw address material and must never be shipped to a client.
 */
throw new Error(
  '@isp-search/config: this subpath is server-only and cannot be bundled for the browser.',
);

export {};
