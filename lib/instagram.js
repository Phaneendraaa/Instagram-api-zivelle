// Thin wrapper over the Instagram API with Instagram Login (graph.instagram.com).
const GRAPH = 'https://graph.instagram.com/v23.0';

async function call(path, { method = 'GET', body, token }) {
  const res = await fetch(`${GRAPH}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error || {};
    throw new Error(`Instagram API ${path}: ${e.message || res.status}${e.code ? ` (code ${e.code})` : ''}`);
  }
  return json;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function waitUntilReady(id, token) {
  for (let i = 0; i < 20; i++) {
    const { status_code } = await call(`/${id}?fields=status_code`, { token });
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`Media container ${id} failed: ${status_code}`);
    await sleep(1500);
  }
  throw new Error(`Media container ${id} was not ready in time`);
}

export async function whoAmI(token) {
  return call('/me?fields=user_id,username,account_type', { token });
}

/** First lines of the latest posts, used to avoid posting the same product twice. */
export async function recentCaptionHeads(userId, token, limit = 50) {
  const { data = [] } = await call(`/${userId}/media?fields=caption,permalink&limit=${limit}`, { token });
  return data.map((m) => ({ head: String(m.caption || '').split('\n')[0].trim(), permalink: m.permalink }));
}

/** Publishes 1 image, or a carousel of 2 to 10 images. Returns { id, permalink }. */
export async function publish({ userId, token, imageUrls, caption }) {
  let creationId;
  if (imageUrls.length === 1) {
    ({ id: creationId } = await call(`/${userId}/media`, { method: 'POST', token, body: { image_url: imageUrls[0], caption } }));
  } else {
    const children = [];
    for (const url of imageUrls.slice(0, 10)) {
      const { id } = await call(`/${userId}/media`, { method: 'POST', token, body: { image_url: url, is_carousel_item: true } });
      children.push(id);
    }
    for (const id of children) await waitUntilReady(id, token);
    ({ id: creationId } = await call(`/${userId}/media`, { method: 'POST', token, body: { media_type: 'CAROUSEL', children: children.join(','), caption } }));
  }
  await waitUntilReady(creationId, token);
  const { id } = await call(`/${userId}/media_publish`, { method: 'POST', token, body: { creation_id: creationId } });
  const { permalink } = await call(`/${id}?fields=permalink`, { token });
  return { id, permalink };
}

/** Publishes one image as a story. Returns { id }. */
export async function publishStory({ userId, token, imageUrl }) {
  const { id: creationId } = await call(`/${userId}/media`, { method: 'POST', token, body: { image_url: imageUrl, media_type: 'STORIES' } });
  await waitUntilReady(creationId, token);
  const { id } = await call(`/${userId}/media_publish`, { method: 'POST', token, body: { creation_id: creationId } });
  return { id };
}
