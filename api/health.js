// GET /api/health  header: x-api-key = POST_SECRET. Checks that the Instagram token still works.
import { whoAmI } from '../lib/instagram.js';

export default async function handler(req, res) {
  if (!process.env.POST_SECRET || req.headers['x-api-key'] !== process.env.POST_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const me = await whoAmI(process.env.IG_ACCESS_TOKEN);
    res.json({ ok: true, username: me.username, accountType: me.account_type, userIdMatches: String(me.user_id) === String(process.env.IG_USER_ID) });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
}
