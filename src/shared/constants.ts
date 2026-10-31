/** Where the signed database and rules are published. */
export const FEED_BASE: string =
  (import.meta.env.WXT_FEED_BASE as string | undefined) || 'https://xvoidbyte.github.io/clickfix-warden/v1/';

/** Leave empty to hide the "Support the project" link everywhere. */
export const DONATE_URL = '';

export const PROJECT_URL = 'https://github.com/xVoidByte/clickfix-warden';
export const PRIVACY_URL = 'https://xvoidbyte.github.io/clickfix-warden/privacy.html';

export const FEED_REFRESH_MINUTES = 60;
export const LOG_LIMIT = 500;
