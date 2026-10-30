// Renders the 1080x1920 Instagram story card for a product: brand, first photo, name, price and the product link.
// Text is drawn as vector paths (opentype.js) with bundled fonts, so it looks the same on any server.
import sharp from 'sharp';
import opentype from 'opentype.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fonts');
const load = (f) => { const b = readFileSync(join(dir, f)); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
// Inter is split into subsets: basic Latin, plus a second file that holds the rupee sign.
const both = (a, b) => ({ unitsPerEm: a.unitsPerEm, charToGlyph: (ch) => { const g = a.charToGlyph(ch); return g.index ? g : b.charToGlyph(ch); } });
let fonts;
const F = () => (fonts ||= { serif: load('playfair-display-latin-400-normal.woff'), serifB: load('playfair-display-latin-600-normal.woff'), sans: both(load('inter-latin-500-normal.woff'), load('inter-latin-ext-500-normal.woff')) });

const W = 1080, H = 1920;
const INK = '#2B2420', GOLD = '#A9814A', BG = '#F4EFE7';

// Simple per-glyph layout (no GSUB shaping), which is all Latin product text needs.
const chW = (font, ch, size) => (font.charToGlyph(ch).advanceWidth * size) / font.unitsPerEm;
const adv = (font, text, size, track = 0) => [...text].reduce((w, ch) => w + chW(font, ch, size) + track, 0) - (text ? track : 0);

function pathFor(font, text, x, y, size, fill, { anchor = 'middle', track = 0 } = {}) {
  const w = adv(font, text, size, track);
  let cx = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  let d = '';
  for (const ch of text) { d += font.charToGlyph(ch).getPath(cx, y, size).toPathData(2); cx += chW(font, ch, size) + track; }
  return `<path fill="${fill}" d="${d}"/>`;
}

function wrap(font, text, size, maxW, tokens) {
  const parts = tokens || text.split(/(\s+)/).filter((t) => t !== '');
  const lines = []; let cur = '';
  for (const t of parts) {
    const next = cur + t;
    if (cur && adv(font, next.trimEnd(), size) > maxW) { lines.push(cur.trimEnd()); cur = t.trimStart(); } else cur = next;
  }
  if (cur.trim()) lines.push(cur.trimEnd());
  return lines;
}

export const rupees = (paise) => `₹${Math.round(Number(paise) / 100).toLocaleString('en-IN')}`;

export async function renderStoryCard({ imageUrl, name, price, compareAt, url }) {
  const { serif, serifB, sans } = F();
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Could not fetch story image (${res.status})`);
  const photo = await sharp(Buffer.from(await res.arrayBuffer())).resize(940, 940, { fit: 'cover' }).jpeg({ quality: 95 }).toBuffer();

  const cx = W / 2;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${BG}"/>`;
  svg += pathFor(serifB, 'ZIVELLE', cx, 215, 54, INK, { track: 14 });
  svg += `<rect x="${cx - 40}" y="248" width="80" height="2" fill="${GOLD}"/>`;
  svg += pathFor(sans, 'NEW IN', cx, 300, 26, GOLD, { track: 9 });

  // soft frame behind the photo
  svg += `<rect x="62" y="342" width="956" height="956" fill="none" stroke="${GOLD}" stroke-opacity="0.55" stroke-width="2"/>`;

  // name (up to 3 lines)
  const nameLines = wrap(serif, name, 58, 900).slice(0, 3);
  let y = 1388;
  for (const l of nameLines) { svg += pathFor(serif, l, cx, y, 58, INK); y += 72; }
  y += 18;
  const priceTxt = rupees(price);
  const pw = adv(sans, priceTxt, 56);
  const showOld = compareAt && compareAt > price;
  const oldTxt = showOld ? rupees(compareAt) : '';
  const cw = showOld ? adv(sans, oldTxt, 34) : 0;
  const total = pw + (showOld ? 26 + cw : 0);
  const px = cx - total / 2;
  svg += pathFor(sans, priceTxt, px, y, 56, INK, { anchor: 'start' });
  if (showOld) {
    const sx = px + pw + 26;
    svg += pathFor(sans, oldTxt, sx, y, 34, '#9A8F85', { anchor: 'start' });
    svg += `<rect x="${sx}" y="${y - 13}" width="${cw}" height="2" fill="#9A8F85"/>`;
  }
  y += 62;
  // product link (wrapped after hyphens and slashes)
  const link = url.replace(/^https?:\/\/(www\.)?/, '');
  const linkLines = wrap(sans, link, 28, 820, link.split(/(?<=[-\/])/)).slice(0, 3);
  const pillW = Math.min(980, Math.max(...linkLines.map((l) => adv(sans, l, 28))) + 90);
  const pillH = 36 + linkLines.length * 40;
  svg += `<rect x="${cx - pillW / 2}" y="${y - 10}" width="${pillW}" height="${pillH}" rx="${Math.min(40, pillH / 2)}" fill="none" stroke="${INK}" stroke-width="2"/>`;
  let ly = y + 36;
  for (const l of linkLines) { svg += pathFor(sans, l, cx, ly, 28, INK); ly += 40; }
  ly += 0;
  svg += pathFor(sans, 'SHOP AT THE LINK IN BIO', cx, ly + 50, 22, GOLD, { track: 6 });
  svg += '</svg>';

  return sharp(Buffer.from(svg)).composite([{ input: photo, left: 70, top: 350 }]).jpeg({ quality: 92 }).toBuffer();
}
