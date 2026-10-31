import { startGuard } from '../src/content/guard';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  allFrames: true,
  matchAboutBlank: true,
  matchOriginAsFallback: { chrome: true, edge: true, firefox: false },
  main() {
    startGuard();
  },
});
