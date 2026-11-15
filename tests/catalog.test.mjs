import { test } from "node:test";
import assert from "node:assert/strict";
import {
  products,
  validateProduct,
  normalizeProducts,
  selectProducts,
  sanitizeIds,
  escapeHTML,
} from "../catalog.mjs";

test("all six inherited demo products have valid finishes and stable local images", () => {
  assert.equal(products.length, 6);
  assert.deepEqual(normalizeProducts(products), products);
  assert.ok(
    products.every(
      (product) =>
        product.active &&
        product.colors.length >= 2 &&
        product.materials.length >= 2,
    ),
  );
});

test("category, price, material, color, query and favorites filters combine", () => {
  const selected = selectProducts("seating", "asc", {
    material: "Ткань",
    color: "graphite",
    maxPrice: 40000,
    query: "кресло",
    favoritesOnly: true,
    favorites: ["soft", "horizon"],
  });
  assert.deepEqual(
    selected.map((product) => product.id),
    ["soft"],
  );
  assert.equal(
    selectProducts("all", "default", { query: "неизвестный объект" }).length,
    0,
  );
  assert.equal(
    selectProducts("all", "default", { color: "Глубокий зелёный" })[0].id,
    "horizon",
  );
});

test("sorting leaves the seed order intact and hidden products stay out of results", () => {
  const before = products.map((product) => product.id);
  const selected = selectProducts("seating", "asc");
  assert.deepEqual(
    selected.map((product) => product.id),
    ["arc", "contour", "soft", "horizon"],
  );
  assert.deepEqual(
    products.map((product) => product.id),
    before,
  );
  const catalog = products.map((product) => ({
    ...product,
    active: product.id !== "arc",
  }));
  assert.equal(
    selectProducts("seating", "desc", {}, catalog).at(-1).id,
    "contour",
  );
});

test("product editor rejects impossible prices, duplicate ids and external or traversing assets", () => {
  const draft = structuredClone(products[0]);
  assert.ok(validateProduct(draft, ["soft"]).errors.id);
  for (const price of [-1, 0, 1.1, Infinity, "32500", 10000001])
    assert.ok(validateProduct({ ...draft, price }).errors.price);
  for (const image of [
    "../secret",
    "https://example.test/photo.jpg",
    "chair.jpg?url=x",
    "/chair.jpg",
  ])
    assert.ok(validateProduct({ ...draft, image }).errors.image);
  assert.ok(
    validateProduct({ ...draft, colors: [draft.colors[0], draft.colors[0]] })
      .errors.colors,
  );
  assert.ok(validateProduct({ ...draft, materials: [] }).errors.materials);
  assert.ok(validateProduct({ ...draft, active: "false" }).errors.active);
  assert.ok(validateProduct({ ...draft, name: " " }).errors.name);
});

test("catalogue restore drops invalid data and duplicate ids while retaining deliberate empty catalogues", () => {
  const restored = normalizeProducts([
    products[0],
    { ...products[1], image: "private.png" },
    products[0],
    products[2],
  ]);
  assert.deepEqual(
    restored.map((product) => product.id),
    ["soft", "circle"],
  );
  assert.deepEqual(normalizeProducts([]), []);
  assert.deepEqual(normalizeProducts({ soft: products[0] }), []);
});

test("favorites and comparison ids are de-duplicated, bounded and pruned after hiding a product", () => {
  const catalog = products.map((product) => ({
    ...product,
    active: product.id !== "soft",
  }));
  assert.deepEqual(
    sanitizeIds(["soft", "arc", "arc", "unknown", "circle", null], catalog, 1),
    ["arc"],
  );
  assert.deepEqual(sanitizeIds("soft"), []);
  assert.deepEqual(sanitizeIds(["soft"], products, 0), []);
});

test("edited user text is escaped before insertion into HTML", () => {
  assert.equal(
    escapeHTML("<img src=x onerror=\"alert(1)\"> & 'finish'"),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;finish&#39;",
  );
});

test("derived material summary remains valid after persistence and reload", () => {
  const draft = {
    ...products[0],
    materials: Array.from({ length: 8 }, (_, i) => `${i}`.repeat(60)),
  };
  delete draft.material;
  const first = validateProduct(draft);
  assert.ok(first.value, JSON.stringify(first.errors));
  assert.ok(first.value.material.length <= 240);
  assert.deepEqual(
    validateProduct(JSON.parse(JSON.stringify(first.value))).value,
    first.value,
  );
  assert.deepEqual(normalizeProducts([first.value]), [first.value]);
});
