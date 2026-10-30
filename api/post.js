// POST /api/post  { slug, dryRun? }   header: x-api-key = POST_SECRET
// Reads the product from the Zivelle store, builds the caption, posts it to Instagram as a carousel.
import { buildCaption } from '../lib/caption.js';
import { publish, publishStory, recentCaptionHeads } from '../lib/instagram.js';
import { signStory } from './story-image.js';

const STORE_URL = (process.env.STORE_URL || 'https://www.thezivelle.shop').replace(/\/$/, '');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const secret = process.env.POST_SECRET;
  if (!secret || req.headers['x-api-key'] !== secret) return res.status(401).json({ error: 'Unauthorized' });
  const token = process.env.IG_ACCESS_TOKEN;
  const userId = process.env.IG_USER_ID;
  if (!token || !userId) return res.status(500).json({ error: 'IG_ACCESS_TOKEN or IG_USER_ID is not set' });

  const { slug, dryRun = false, force = false, noStory = false, storyOnly = false, product: given } = req.body || {};
  if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ error: 'A valid product slug is required' });

  try {
    // The store backend may send the product itself (so a product can be posted during its own deploy, before the live API has it).
    let product = given && typeof given === 'object' && given.name ? given : null;
    if (!product) {
      const r = await fetch(`${STORE_URL}/api/products/${slug}`);
      if (r.status === 404) return res.status(404).json({ error: 'Product not found' });
      if (!r.ok) return res.status(502).json({ error: `Store returned ${r.status}` });
      ({ product } = await r.json());
    }
    const imageUrls = (product.images || []).map((u) => (u.startsWith('http') ? u : `${STORE_URL}${u}`)).slice(0, 10);
    if (!imageUrls.length) return res.status(422).json({ error: 'Product has no images' });
    const caption = buildCaption(product);

    if (dryRun) return res.json({ dryRun: true, caption, imageUrls });

    if (!force && !storyOnly) {
      const name = product.name.trim();
      const dup = (await recentCaptionHeads(userId, token)).find((m) => m.head === name);
      if (dup) return res.status(409).json({ error: 'Already posted', permalink: dup.permalink });
    }
    const out = storyOnly ? {} : await publish({ userId, token, imageUrls, caption });

    // Also post a story card (first photo, name, price and the product link). A story failure never undoes the post.
    let story = null;
    if (!noStory && product.price) {
      try {
        const f = { img: imageUrls[0], name: product.name.trim(), price: String(product.price), old: product.compareAtPrice && product.compareAtPrice > product.price ? String(product.compareAtPrice) : '', slug };
        const origin = process.env.PUBLIC_URL || `https://${req.headers.host}`;
        const qs = new URLSearchParams({ img: f.img, name: f.name, price: f.price, slug, ...(f.old ? { old: f.old } : {}), sig: signStory(secret, f) });
        story = await publishStory({ userId, token, imageUrl: `${origin}/api/story-image?${qs}` });
      } catch (e) {
        story = { error: e.message };
      }
    }
    return res.json({ posted: !storyOnly, ...out, story });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
