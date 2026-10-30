// Builds the Instagram caption for a Zivelle product.
// Rule (owner): line 1 = exact website product name, line 2 = the shop line, then details and hashtags.
export const SHOP_LINE = '🛍️Shop with link in bio🖇️🔗';

const BASE_TAGS = ['Zivelle', 'ZivelleStyle', 'WomensFashion', 'OOTD'];

function tagify(s) {
  return String(s)
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
}

function sizesLine(variants = []) {
  const sizes = [];
  for (const v of variants) {
    const s = v?.options?.Size ?? v?.title;
    if (s && !sizes.includes(s) && s !== 'Default Title') sizes.push(s);
  }
  if (!sizes.length) return '';
  if (sizes.length === 1) return sizes[0] === 'Free Size' ? 'Free size.' : `Size ${sizes[0]}.`;
  return `Sizes ${sizes[0]} to ${sizes[sizes.length - 1]}.`;
}

export function buildCaption(product) {
  const name = String(product.name).trim();
  const blurb = String(product.shortDescription || '').trim();
  const tags = [...BASE_TAGS];
  for (const t of product.tags || []) {
    const h = tagify(t);
    if (h.length > 2 && h.length <= 30 && !tags.includes(h)) tags.push(h);
    if (tags.length >= 12) break;
  }
  const parts = [`${name}\n${SHOP_LINE}`];
  if (blurb) parts.push(blurb);
  const sizes = sizesLine(product.variants);
  if (sizes) parts.push(sizes);
  parts.push(tags.map((t) => `#${t}`).join(' '));
  return parts.join('\n\n');
}
