import {test} from 'node:test';
import assert from 'node:assert/strict';
import {products,sanitizeCart,cartTotals,selectProducts} from '../catalog.mjs';
test('stored data accepts only known products and positive integer quantities',()=>{assert.deepEqual(sanitizeCart({soft:2,arc:1,ray:-1,unknown:5,contour:'2',circle:1.5}),{soft:2,arc:1});});
test('stored quantities are capped and arrays or null discarded',()=>{assert.deepEqual(sanitizeCart({soft:999}),{soft:20});for(const value of [null,[],false,'soft',7])assert.deepEqual(sanitizeCart(value),{});});
test('totals calculate exact quantities and prices',()=>{assert.deepEqual(cartTotals({soft:2,arc:3}),{count:5,total:32500*2+14500*3});assert.deepEqual(cartTotals({}),{count:0,total:0});});
test('category filter and price sort combine without changing catalogue',()=>{const before=products.map(p=>p.id);const selected=selectProducts('seating','asc');assert.equal(selected.length,4);assert.equal(selected[0].id,'arc');assert.equal(selected.at(-1).id,'horizon');assert.deepEqual(products.map(p=>p.id),before);assert.equal(selectProducts('light')[0].id,'ray');});
