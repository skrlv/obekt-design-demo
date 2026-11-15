import test from "node:test";
import http from "node:http";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./server.mjs";

const dir = await mkdtemp(join(tmpdir(), "obekt-server-"));
const dataFile = join(dir, "products.json");
let app, url;
async function start() {
  app = await createApp({ dataFile });
  await new Promise((r) => app.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${app.address().port}`;
}
async function stop() {
  await new Promise((r) => app.close(r));
}
await start();
const send = (path, method, body, headers = {}) =>
  fetch(url + path, {
    method,
    headers: { "Content-Type": "application/json", Origin: url, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

test("API: persistent CRUD, rejection, and static boundary", async (t) => {
  const initial = await (await fetch(url + "/api/products")).json();
  assert.equal(initial.demo, true);
  assert.ok(initial.products.length >= 6);
  const seed = structuredClone(initial.products[0]);
  const item = {
    ...seed,
    id: "server-test",
    name: "Тестовый предмет",
    price: 12345,
  };
  await t.test("create persists to file", async () => {
    const res = await send("/api/products", "POST", item);
    assert.equal(res.status, 201);
    assert.equal(
      JSON.parse(await readFile(dataFile, "utf8")).find((p) => p.id === item.id)
        .price,
      12345,
    );
  });
  await t.test("duplicate and negative price rejected", async () => {
    assert.equal((await send("/api/products", "POST", item)).status, 422);
    assert.equal(
      (
        await send("/api/products", "POST", {
          ...item,
          id: "invalid",
          price: -1,
        })
      ).status,
      422,
    );
  });
  await t.test(
    "cross-origin and cross-site mutation rejected; non-local host rejected",
    async () => {
      assert.equal(
        (
          await send("/api/products/server-test", "DELETE", undefined, {
            Origin: "https://external.example",
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await send("/api/products/server-test", "DELETE", undefined, {
            "Sec-Fetch-Site": "cross-site",
          })
        ).status,
        403,
      );
      const status = await new Promise((resolve, reject) => {
        const request = http.get(
          url + "/api/products",
          { headers: { Host: "external.example" } },
          (response) => {
            response.resume();
            resolve(response.statusCode);
          },
        );
        request.on("error", reject);
      });
      assert.equal(status, 403);
      assert.equal(
        (
          await fetch(url + "/api/products", {
            method: "OPTIONS",
            headers: { Origin: "https://external.example" },
          })
        ).status,
        405,
      );
    },
  );
  await t.test(
    "concurrent duplicate creates serialize; unknown collection paths rejected",
    async () => {
      const concurrent = { ...item, id: "parallel-test" };
      const replies = await Promise.all([
        send("/api/products", "POST", concurrent),
        send("/api/products", "POST", concurrent),
      ]);
      assert.deepEqual(replies.map((r) => r.status).sort(), [201, 422]);
      assert.equal(
        JSON.parse(await readFile(dataFile, "utf8")).filter(
          (p) => p.id === concurrent.id,
        ).length,
        1,
      );
      assert.equal(
        (await send("/api/products/", "POST", { ...item, id: "bad-path-one" }))
          .status,
        404,
      );
      assert.equal(
        (
          await send("/api/products//extra", "POST", {
            ...item,
            id: "bad-path-two",
          })
        ).status,
        404,
      );
      assert.equal(
        (await send("/api/products/parallel-test", "DELETE")).status,
        200,
      );
    },
  );
  await t.test(
    "update id cannot change and image path cannot escape",
    async () => {
      assert.equal(
        (
          await send("/api/products/server-test", "PUT", {
            ...item,
            id: "other",
          })
        ).status,
        422,
      );
      assert.equal(
        (
          await send("/api/products/server-test", "PUT", {
            ...item,
            image: "../secret.jpg",
          })
        ).status,
        422,
      );
      assert.equal(
        (
          await send("/api/products/server-test", "PUT", {
            ...item,
            price: 23456,
          })
        ).status,
        200,
      );
    },
  );
  await t.test(
    "static files served; runtime and source secrets hidden",
    async () => {
      assert.equal((await fetch(url + "/")).status, 200);
      assert.equal((await fetch(url + "/assets/chair.jpg")).status, 200);
      for (const path of [
        "/server/data/products.json",
        "/.git/config",
        "/server/server.mjs",
        "/%2e%2e/%2eenv",
      ])
        assert.equal((await fetch(url + path)).status, 404);
    },
  );
  await t.test("data survives server restart", async () => {
    await stop();
    await start();
    const raw = await (await fetch(url + "/api/products")).json();
    assert.equal(raw.products.find((p) => p.id === item.id).price, 23456);
  });
  await t.test("delete and missing ID", async () => {
    assert.equal(
      (await send("/api/products/server-test", "DELETE")).status,
      200,
    );
    assert.equal(
      (await send("/api/products/server-test", "DELETE")).status,
      404,
    );
  });
  await t.test(
    "invalid json, large request and content type rejected",
    async () => {
      assert.equal(
        (
          await fetch(url + "/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json", Origin: url },
            body: "{bad",
          })
        ).status,
        400,
      );
      assert.equal(
        (await send("/api/products", "POST", { text: "x".repeat(40000) }))
          .status,
        413,
      );
      assert.equal(
        (
          await send(
            "/api/products",
            "POST",
            {},
            { "Content-Type": "text/plain" },
          )
        ).status,
        415,
      );
      assert.equal(
        (
          await send(
            "/api/products",
            "POST",
            {},
            { "Content-Type": "application/json-invalid" },
          )
        ).status,
        415,
      );
      assert.equal((await send("/api/products", "POST", null)).status, 422);
    },
  );
});
test.after(async () => {
  await stop();
  await rm(dir, { recursive: true, force: true });
});

test("invalid saved data stops startup instead of silently replacing it", async () => {
  const corrupt = join(dir, "corrupt.json");
  await writeFile(corrupt, "{invalid");
  await assert.rejects(createApp({ dataFile: corrupt }));
  await writeFile(corrupt, JSON.stringify([{ id: "broken" }]));
  await assert.rejects(
    createApp({ dataFile: corrupt }),
    /Некорректное хранилище/,
  );
});

test("failed persistence leaves in-memory catalog unchanged", async () => {
  const blocker = join(dir, "blocked-directory");
  const isolated = await createApp({ dataFile: join(blocker, "catalog.json") });
  await writeFile(blocker, "file, not a directory");
  await new Promise((resolve) => isolated.listen(0, "127.0.0.1", resolve));
  try {
    const local = `http://127.0.0.1:${isolated.address().port}`;
    const initial = await (await fetch(local + "/api/products")).json();
    const response = await fetch(local + "/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: local },
      body: JSON.stringify({ ...initial.products[0], id: "must-not-persist" }),
    });
    assert.equal(response.status, 500);
    assert.equal(
      (await response.json()).error,
      "Не удалось сохранить данные. Повторите действие.",
    );
    assert.deepEqual(
      (await (await fetch(local + "/api/products")).json()).products,
      initial.products,
    );
  } finally {
    await new Promise((resolve) => isolated.close(resolve));
  }
});
