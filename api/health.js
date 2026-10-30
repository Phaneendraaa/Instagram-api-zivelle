// GET /api/health  Public. Reports only whether the token works and the (public) username; no secrets.
import { whoAmI } from '../lib/instagram.js';

export default async function handler(req, res) {
  try {
    const me = await whoAmI(process.env.IG_ACCESS_TOKEN);
    res.json({ ok: true, username: me.username, accountType: me.account_type, userIdMatches: String(me.user_id) === String(process.env.IG_USER_ID), postSecretSet: Boolean(process.env.POST_SECRET) });
  } catch (e) {
    res.status(502).json({ ok: false, error: 'Instagram token check failed' });
  }
}
