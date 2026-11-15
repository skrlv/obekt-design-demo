import { test } from "node:test";
import assert from "node:assert/strict";
import { products, sanitizeCart, cartTotals, variantKey } from "../catalog.mjs";

const line = (id = "soft", quantity = 1, overrides = {}) => {
  const product = products.find((item) => item.id === id);
  return {
    id,
    color: product.colors[0].id,
    material: product.materials[0],
    quantity,
    ...overrides,
  };
};

test("restored cart discards unknown products, stale finishes and malformed quantities", () => {
  const valid = line("soft", 2);
  const raw = [
    valid,
    line("arc", 3),
    { ...valid, id: "unknown" },
    line("soft", 1, { color: "unavailable" }),
    line("soft", 1, { material: "obsolete" }),
    line("soft", -1),
    line("soft", 1.5),
    line("soft", "2"),
    null,
  ];
  assert.deepEqual(sanitizeCart(raw), [valid, line("arc", 3)]);
  for (const value of [null, {}, false, "soft", 7])
    assert.deepEqual(sanitizeCart(value), []);
});

test("cart merges equal variants, preserves distinct finishes and caps each quantity", () => {
  const secondFinish = line("soft", 3, { color: products[0].colors[1].id });
  const result = sanitizeCart([
    line("soft", 15),
    line("soft", 9),
    secondFinish,
  ]);
  assert.deepEqual(result, [line("soft", 20), secondFinish]);
  assert.notEqual(variantKey(result[0]), variantKey(result[1]));
});

test("cart totals use current catalogue prices and remove inactive products", () => {
  const raw = [line("soft", 2, { price: 1 }), line("arc", 3)];
  assert.deepEqual(cartTotals(raw), { count: 5, total: 32500 * 2 + 14500 * 3 });
  const changed = products.map((product) =>
    product.id === "soft"
      ? { ...product, price: 100 }
      : { ...product, active: false },
  );
  assert.deepEqual(cartTotals(raw, changed), { count: 2, total: 200 });
  assert.deepEqual(cartTotals([]), { count: 0, total: 0 });
});

test("restoring cart never mutates stored input or catalogue", () => {
  const raw = [line("soft", 99), line("arc", 2)];
  const before = structuredClone(raw);
  const catalogueBefore = structuredClone(products);
  sanitizeCart(raw);
  assert.deepEqual(raw, before);
  assert.deepEqual(products, catalogueBefore);
});

test("cart is bounded to sixty distinct valid variants", () => {
  const catalogue = Array.from({ length: 70 }, (_, i) => ({
    ...products[0],
    id: `item-${i}`,
  }));
  const restored = sanitizeCart(
    catalogue.map((product) => ({
      id: product.id,
      color: product.colors[0].id,
      material: product.materials[0],
      quantity: 1,
    })),
    catalogue,
  );
  assert.equal(restored.length, 60);
  assert.equal(cartTotals(restored, catalogue).count, 60);
});
