import { installHooks } from '../src/content/hooks';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  allFrames: true,
  matchAboutBlank: true,
  matchOriginAsFallback: { chrome: true, edge: true, firefox: false },
  world: 'MAIN',
  main() {
    installHooks(window);
  },
});
