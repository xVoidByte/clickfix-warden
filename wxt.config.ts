import { defineConfig } from 'wxt';

const isE2E = process.argv.includes('e2e');

export default defineConfig({
  manifestVersion: 3,
  outDirTemplate: isE2E ? '{{browser}}-mv{{manifestVersion}}-e2e' : '{{browser}}-mv{{manifestVersion}}{{modeSuffix}}',
  zip: {
    artifactTemplate: '{{name}}-{{version}}-{{browser}}.zip',
    sourcesTemplate: '{{name}}-{{version}}-sources.zip',
    excludeSources: ['.work/**', 'store/screenshots/**', 'test-results/**', 'playwright-report/**'],
  },
  manifest: ({ browser }) => ({
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    homepage_url: 'https://github.com/xVoidByte/ClickFixWarden',
    permissions: ['storage', 'unlimitedStorage', 'alarms', 'webNavigation', 'webRequest', 'clipboardWrite'],
    optional_permissions: ['history', 'management'],
    host_permissions: ['<all_urls>'],
    action: { default_title: '__MSG_extName__' },
    // The warning fonts load into pages, Chrome hands them out under a per-session address so sites cannot probe for the extension.
    web_accessible_resources: [
      browser === 'firefox'
        ? { resources: ['fonts/*.woff2'], matches: ['<all_urls>'] }
        : { resources: ['fonts/*.woff2'], matches: ['<all_urls>'], use_dynamic_url: true },
    ],
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'clickfix-warden@xvoidbyte',
              strict_min_version: '142.0',
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : {
          minimum_chrome_version: '121',
          storage: { managed_schema: 'managed_schema.json' },
        }),
  }),
});
