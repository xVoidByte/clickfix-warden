/** Where the signed database and rules are published. */
export const FEED_BASE: string =
  (import.meta.env.WXT_FEED_BASE as string | undefined) || 'https://xvoidbyte.github.io/ClickFixWarden/v1/';

/** Leave empty to hide the "Support the project" link everywhere. */
export const DONATE_URL = 'https://ko-fi.com/S6S51N452I';

export const PROJECT_URL = 'https://github.com/xVoidByte/ClickFixWarden';
export const PRIVACY_URL = 'https://xvoidbyte.github.io/ClickFixWarden/privacy.html';

export const FEED_REFRESH_MINUTES = 60;
export const LOG_LIMIT = 500;
