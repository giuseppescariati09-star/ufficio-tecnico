import { readFileSync, writeFileSync } from 'node:fs';

const names = ['folder', 'clock', 'mic', 'user', 'chevron-left', 'check', 'x', 'external-link', 'download', 'upload', 'play', 'square', 'triangle-alert'];
const icons = Object.fromEntries(names.map((n) => {
  const svg = readFileSync(new URL(`../node_modules/lucide-static/icons/${n}.svg`, import.meta.url), 'utf8');
  return [n, svg.replace(/<!--[\s\S]*?-->/g, '').match(/<svg[^>]*>([\s\S]*)<\/svg>/)[1].replace(/\s*\n\s*/g, '')];
}));
writeFileSync(new URL('../js/icons.js', import.meta.url), `export const ICONS = ${JSON.stringify(icons, null, 2)};\n`);
