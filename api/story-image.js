// GET /api/story-image?img=&name=&price=&old=&slug=&sig=  -> the story card JPEG that Instagram downloads.
// The signature (HMAC of the fields with POST_SECRET) stops other people using this as a free image generator.
import { timingSafeEqual } from 'node:crypto';
import { signStory } from '../lib/story-sign.js';
import { renderStoryCard } from '../lib/story-card.js';

const STORE_URL = (process.env.STORE_URL || 'https://www.thezivelle.shop').replace(/\/$/, '');

export default async function handler(req, res) {
  const secret = process.env.POST_SECRET;
  const q = req.query || {};
  if (!secret || typeof q.sig !== 'string' || !q.img || !q.name || !q.price || !q.slug) return res.status(400).end('bad request');
  const want = Buffer.from(signStory(secret, q));
  const got = Buffer.from(q.sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return res.status(401).end('bad signature');
  if (!/^https:\/\//.test(q.img)) return res.status(400).end('bad image');
  try {
    const jpg = await renderStoryCard({ imageUrl: q.img, name: q.name, price: Number(q.price), compareAt: q.old ? Number(q.old) : 0, style: Number(q.style) || 0 });
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(jpg);
  } catch (e) {
    return res.status(502).end(e.message);
  }
}
