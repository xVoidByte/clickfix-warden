import { FONT_FACES, PARTS_CSS } from './graphite';

/** Adds the bundled fonts and the shared warning styles to an extension page. */
export function addPageParts(): void {
  const style = document.createElement('style');
  style.textContent = FONT_FACES((p) => '/' + p) + PARTS_CSS;
  document.head.appendChild(style);
}
