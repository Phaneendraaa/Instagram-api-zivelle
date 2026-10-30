// Daily job (Vercel Cron): posts the newest product that was added to the store recently and is not on Instagram yet.
// Auth: Vercel sends "Authorization: Bearer <CRON_SECRET>". At most MAX_POSTS_PER_RUN (default 1) posts per run.
import { buildCaption } from '../lib/caption.js';
import { publish, recentCaptionHeads } from '../lib/instagram.js';

const STORE_URL = (process.env.STORE_URL || 'https://www.thezivelle.shop').replace(/\/$/, '');
const MAX_AGE_HOURS = Number(process.env.MAX_AGE_HOURS || 48);
const MAX_POSTS = Number(process.env.MAX_POSTS_PER_RUN || 1);

export default async function handler(req, res) {
  const cron = process.env.CRON_SECRET;
  if (!cron || req.headers.authorization !== `Bearer ${cron}`) return res.status(401).json({ error: 'Unauthorized' });
  const token = process.env.IG_ACCESS_TOKEN;
  const userId = process.env.IG_USER_ID;
  if (!token || !userId) return res.status(500).json({ error: 'IG_ACCESS_TOKEN or IG_USER_ID is not set' });
  const dryRun = req.query?.dryRun === '1';

  try {
    const list = await (await fetch(`${STORE_URL}/api/products?newArrival=true&sort=newest&limit=12`)).json();
    const posted = new Set((await recentCaptionHeads(userId, token)).map((m) => m.head));
    const cutoff = Date.now() - MAX_AGE_HOURS * 3600e3;
    const results = [];
    for (const card of list.items || []) {
      if (results.filter((r) => r.posted).length >= MAX_POSTS) break;
      if (posted.has(card.name.trim())) continue;
      const { product } = await (await fetch(`${STORE_URL}/api/products/${card.slug}`)).json();
      if (!product?.createdAt || new Date(product.createdAt).getTime() < cutoff) continue;
      const imageUrls = (product.images || []).map((u) => (u.startsWith('http') ? u : `${STORE_URL}${u}`)).slice(0, 10);
      if (!imageUrls.length) continue;
      const caption = buildCaption(product);
      if (dryRun) { results.push({ slug: card.slug, dryRun: true, caption }); continue; }
      const out = await publish({ userId, token, imageUrls, caption });
      results.push({ slug: card.slug, posted: true, ...out });
    }
    return res.json({ checked: (list.items || []).length, results });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
