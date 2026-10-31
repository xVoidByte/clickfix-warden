import { browser } from 'wxt/browser';
import { type FeedHit, SOURCE_NAMES } from '../../src/feed/types';
import { localizePage, t } from '../../src/shared/i18n';
import type { Message } from '../../src/shared/messages';

localizePage();

const target = new URLSearchParams(location.search).get('u') ?? '';
const send = (msg: Message) => browser.runtime.sendMessage(msg);

document.getElementById('url')!.textContent = target;

async function render(): Promise<void> {
  const list = document.getElementById('reports')!;
  const hits = ((await send({ type: 'lookup-url', url: target })) ?? []) as FeedHit[];
  for (const hit of hits) {
    for (const r of hit.records) {
      const li = document.createElement('li');
      const head = document.createElement('div');
      head.textContent = [SOURCE_NAMES[r.source], t('category_' + r.category), r.malware].filter(Boolean).join(', ');
      const meta = document.createElement('div');
      meta.className = 'small muted';
      meta.textContent = [r.firstSeen ? t('bannerFirstSeen', r.firstSeen) : '', r.tags.length ? r.tags.join(', ') : ''].filter(Boolean).join(' | ');
      li.append(head, meta);
      if (/^https:\/\/(urlhaus|threatfox|feodotracker)\.abuse\.ch\//.test(r.ref)) {
        const a = document.createElement('a');
        a.href = r.ref;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = t('bannerDetails');
        li.append(a);
      }
      list.append(li);
    }
  }
}

document.getElementById('leave')!.addEventListener('click', () => void send({ type: 'leave-site' }));
document.getElementById('continue')!.addEventListener('click', () => {
  if (/^https?:\/\//i.test(target)) void send({ type: 'bypass', url: target });
});

void render();
