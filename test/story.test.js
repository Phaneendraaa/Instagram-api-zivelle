import test from 'node:test';
import assert from 'node:assert/strict';
import { signStory } from '../lib/story-sign.js';
import { rupees } from '../lib/story-card.js';

test('story signature depends on every field', () => {
  const f = { img: 'https://x/y.jpg', name: 'A', price: '100', old: '', slug: 'a' };
  assert.equal(signStory('k', f), signStory('k', { ...f }));
  assert.notEqual(signStory('k', f), signStory('k', { ...f, price: '101' }));
  assert.notEqual(signStory('k', f), signStory('z', f));
});

test('rupees formats paise with Indian grouping', () => {
  assert.equal(rupees(120000), '₹1,200');
  assert.equal(rupees(1234500), '₹12,345');
});
