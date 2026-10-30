// Renders the 1080x1920 Instagram story card for a product: brand, first photo, name, price and the product link.
// Text is drawn as vector paths (opentype.js) with bundled fonts, so it looks the same on any server.
import sharp from 'sharp';
import { STORY_STYLES } from './story-sign.js';
import opentype from 'opentype.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fonts');
const load = (f) => { const b = readFileSync(join(dir, f)); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
// Inter is split into subsets: basic Latin, plus a second file that holds the rupee sign.
const both = (a, b) => ({ unitsPerEm: a.unitsPerEm, charToGlyph: (ch) => { const g = a.charToGlyph(ch); return g.index ? g : b.charToGlyph(ch); } });
let fonts;
const F = () => (fonts ||= { serif: load('playfair-display-latin-400-normal.woff'), serifB: load('playfair-display-latin-600-normal.woff'), sans: both(load('inter-latin-500-normal.woff'), load('inter-latin-ext-500-normal.woff')), sansB: both(load('inter-latin-700-normal.woff'), load('inter-latin-ext-700-normal.woff')) });

const W = 1080, H = 1920;
const INK = '#2B2420', GOLD = '#A9814A', BG = '#F4EFE7';

// Simple per-glyph layout (no GSUB shaping), which is all Latin product text needs.
const chW = (font, ch, size) => (font.charToGlyph(ch).advanceWidth * size) / font.unitsPerEm;
const adv = (font, text, size, track = 0) => [...text].reduce((w, ch) => w + chW(font, ch, size) + track, 0) - (text ? track : 0);

const glyphCache = new Map();
function glyphPath(font, ch, size) {
  const gl = font.charToGlyph(ch);
  const key = `${font.unitsPerEm}|${gl.index}|${gl.advanceWidth}`;
  // Outlines are built at 1 unit = 1 font unit (some glyphs give NaN at small pixel sizes) and scaled with a transform.
  if (!glyphCache.has(key)) glyphCache.set(key, gl.getPath(0, 0, font.unitsPerEm).toPathData(1));
  return glyphCache.get(key);
}

function pathFor(font, text, x, y, size, fill, { anchor = 'middle', track = 0 } = {}) {
  const w = adv(font, text, size, track);
  let cx = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  // Each glyph is drawn at the origin and moved with a transform; absolute coordinates can produce NaN in opentype.js.
  let out = '';
  for (const ch of text) {
    const g = glyphPath(font, ch, size);
    if (g && !/NaN|Infinity/.test(g)) out += `<path transform="translate(${cx.toFixed(2)} ${y}) scale(${(size / font.unitsPerEm).toFixed(5)})" d="${g}"/>`;
    cx += chW(font, ch, size) + track;
  }
  return `<g fill="${fill}">${out}</g>`;
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


const mix = (rgb, to, t) => rgb.map((c, i) => Math.round(c * (1 - t) + to[i] * t));
const hex = (rgb) => `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;

// Four looks. Each one keeps the content inside Instagram's safe zone (nothing below y=1700 or above y=190).
//  0 classic ivory with a gold frame   1 blurred photo background, white text
//  2 noir with gold                    3 arch window on a tint taken from the photo
function theme(style, avg) {
  switch (style % STORY_STYLES) {
    case 1: return { bg: '#2A2523', ink: '#FFFFFF', accent: '#FFFFFF', sub: '#E6DED6', rule: '#FFFFFF', photo: { w: 920, h: 920, shape: 'square', border: '#FFFFFF' }, blur: true };
    case 2: return { bg: '#1E1A17', ink: '#F4EFE7', accent: '#C9A25E', sub: '#8F857B', rule: '#C9A25E', photo: { w: 880, h: 880, shape: 'square', border: '#C9A25E' } };
    case 3: {
      const tint = mix(avg, [255, 255, 255], 0.82);
      return { bg: hex(tint), ink: '#2B2420', accent: hex(mix(avg, [0, 0, 0], 0.45)), sub: '#7A6F66', rule: hex(mix(avg, [0, 0, 0], 0.45)), photo: { w: 820, h: 940, shape: 'arch' } };
    }
    default: return { bg: BG, ink: INK, accent: GOLD, sub: '#9A8F85', rule: GOLD, photo: { w: 880, h: 880, shape: 'square', border: GOLD } };
  }
}

export async function renderStoryCard({ imageUrl, name, price, compareAt, style = 0 }) {
  const { serif, serifB, sans, sansB } = F();
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Could not fetch story image (${res.status})`);
  const src = Buffer.from(await res.arrayBuffer());
  const { data } = await sharp(src).resize(1, 1).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const t = theme(style, [data[0], data[1], data[2]]);
  const { w: pw0, h: ph0, shape } = t.photo;
  const left = Math.round((W - pw0) / 2), top = 350;

  let photo = await sharp(src).resize(pw0, ph0, { fit: 'cover' }).jpeg({ quality: 95 }).toBuffer();
  if (shape === 'arch') {
    const r = pw0 / 2;
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${pw0}" height="${ph0}"><path d="M0 ${ph0}V${r}A${r} ${r} 0 0 1 ${pw0} ${r}V${ph0}Z" fill="#fff"/></svg>`);
    photo = await sharp(photo).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  }

  const cx = W / 2;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  svg += t.blur ? '<rect width="1080" height="1920" fill="#000" fill-opacity="0.38"/>' : `<rect width="${W}" height="${H}" fill="${t.bg}"/>`;
  svg += pathFor(serifB, 'ZIVELLE', cx, 215, 54, t.ink, { track: 14 });
  svg += `<rect x="${cx - 40}" y="248" width="80" height="2" fill="${t.accent}"/>`;
  svg += pathFor(sans, 'NEW IN', cx, 300, 26, t.accent, { track: 9 });

  if (t.photo.border) svg += `<rect x="${left - 8}" y="${top - 8}" width="${pw0 + 16}" height="${ph0 + 16}" fill="none" stroke="${t.photo.border}" stroke-opacity="${t.blur ? 1 : 0.6}" stroke-width="${t.blur ? 4 : 2}"/>`;
  if (shape === 'arch') svg += `<path d="M${left - 10} ${top + ph0 + 10}V${top + pw0 / 2}A${pw0 / 2 + 10} ${pw0 / 2 + 10} 0 0 1 ${left + pw0 + 10} ${top + pw0 / 2}V${top + ph0 + 10}Z" fill="none" stroke="${t.accent}" stroke-width="2"/>`;

  // name (up to 3 lines)
  let y = top + ph0 + (shape === 'arch' ? 90 : 82);
  const nameLines = wrap(serif, name, 54, 900).slice(0, 3);
  for (const l of nameLines) { svg += pathFor(serif, l, cx, y, 54, t.ink); y += 66; }
  y += 14;
  const priceTxt = rupees(price);
  const pw = adv(sans, priceTxt, 56);
  const showOld = compareAt && compareAt > price;
  const oldTxt = showOld ? rupees(compareAt) : '';
  const cw = showOld ? adv(sans, oldTxt, 34) : 0;
  const px = cx - (pw + (showOld ? 26 + cw : 0)) / 2;
  svg += pathFor(sans, priceTxt, px, y, 56, t.ink, { anchor: 'start' });
  if (showOld) {
    const sx = px + pw + 26;
    svg += pathFor(sans, oldTxt, sx, y, 34, t.sub, { anchor: 'start' });
    svg += `<rect x="${sx}" y="${y - 13}" width="${cw}" height="2" fill="${t.sub}"/>`;
  }
  y += 60;
  const tag = 'LINK IN BIO';
  const tw = adv(sansB, tag, 64, 10);
  svg += pathFor(sansB, tag, cx, y + 60, 64, t.ink, { track: 10 });
  svg += `<rect x="${cx - tw / 2}" y="${y - 6}" width="${tw}" height="3" fill="${t.rule}"/><rect x="${cx - tw / 2}" y="${y + 92}" width="${tw}" height="3" fill="${t.rule}"/>`;
  svg += '</svg>';

  let base = sharp(Buffer.from(svg));
  if (t.blur) {
    const bg = await sharp(src).resize(W, H, { fit: 'cover' }).blur(40).jpeg({ quality: 85 }).toBuffer();
    return sharp(bg).composite([{ input: Buffer.from(svg) }, { input: photo, left, top }]).jpeg({ quality: 92 }).toBuffer();
  }
  return base.composite([{ input: photo, left, top }]).jpeg({ quality: 92 }).toBuffer();
}
