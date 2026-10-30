import { createHmac } from 'node:crypto';

/** HMAC of the story card fields, so only this service can ask for a story image. */
export const signStory = (secret, f) => createHmac('sha256', secret).update([f.img, f.name, f.price, f.old || '', f.slug].join('|')).digest('hex');
