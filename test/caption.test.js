import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCaption, SHOP_LINE } from '../lib/caption.js';

test('line 1 is the exact product name and line 2 the shop line', () => {
  const c = buildCaption({
    name: 'Dusty Rose Floral Paisley Cotton Kurta with Pants Set',
    shortDescription: 'Dusty rose cotton kurta with a bold floral paisley print and mauve pants.',
    tags: ['kurta set', 'paisley print'],
    variants: [{ options: { Size: 'S' } }, { options: { Size: 'M' } }, { options: { Size: 'XXL' } }],
  });
  const lines = c.split('\n');
  assert.equal(lines[0], 'Dusty Rose Floral Paisley Cotton Kurta with Pants Set');
  assert.equal(lines[1], SHOP_LINE);
  assert.match(c, /Sizes S to XXL\./);
  assert.match(c, /#KurtaSet #PaisleyPrint|#KurtaSet/);
});

test('free size and no tags', () => {
  const c = buildCaption({ name: 'X', variants: [{ options: { Size: 'Free Size' } }] });
  assert.match(c, /Free size\./);
});
