# Instagram API for Zivelle

Posts a Zivelle product to Instagram as a carousel, using the Instagram API with Instagram Login.

## Endpoints
- `POST /api/post` with header `x-api-key: <POST_SECRET>` and JSON `{ "slug": "product-slug", "dryRun": true }`
  - `dryRun` returns the caption and image URLs without posting.
  - Refuses to post a product whose name already starts a recent caption (use `"force": true` to override).
- `GET /api/health` with the same header. Confirms the token works.

## Caption format
1. Exact product name (as on the website)
2. `🛍️Shop with link in bio🖇️🔗`
3. Short description, sizes, hashtags

## Environment variables (Vercel)
| Name | Value |
| --- | --- |
| `IG_ACCESS_TOKEN` | Token from Meta app, Instagram login, Generate token (valid 60 days) |
| `IG_USER_ID` | Instagram account ID |
| `POST_SECRET` | Long random string; the store backend sends it as `x-api-key` |
| `STORE_URL` | Optional, defaults to `https://www.thezivelle.shop` |

The token expires after 60 days. Generate a new one in the Meta app and update `IG_ACCESS_TOKEN`.
