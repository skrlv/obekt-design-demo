import http from "node:http";
import { readFile, writeFile, mkdir, rename, stat } from "node:fs/promises";
import { resolve, dirname, extname, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { products as seeds, validateProduct } from "../catalog.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_BODY = 32 * 1024;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};
const allowedStatic = new Set([
  "index.html",
  "styles.css",
  "app.js",
  "catalog.mjs",
  "panel.html",
  "panel.js",
  "panel.css",
]);

function validate(input, ids = []) {
  if (!input || Array.isArray(input) || typeof input !== "object")
    return { errors: { body: "Нужен JSON-объект товара" } };
  const result = validateProduct(input, ids);
  if (Object.keys(result.errors || {}).length || !result.value) return result;
  return result;
}

export async function createApp({
  dataFile = resolve(ROOT, "server/data/products.json"),
  root = ROOT,
} = {}) {
  let products;
  try {
    const raw = JSON.parse(await readFile(dataFile, "utf8"));
    if (!Array.isArray(raw) || raw.length > 200)
      throw new Error("Некорректное хранилище товаров");
    const ids = [];
    products = raw.map((p) => {
      const checked = validate(p, ids);
      if (!checked.value || Object.keys(checked.errors || {}).length)
        throw new Error("Некорректное хранилище товаров");
      ids.push(checked.value.id);
      return checked.value;
    });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    products = structuredClone(seeds);
  }
  let queue = Promise.resolve();
  async function persist(next) {
    await mkdir(dirname(dataFile), { recursive: true });
    const temporary = `${dataFile}.tmp`;
    await writeFile(temporary, JSON.stringify(next, null, 2) + "\n", {
      mode: 0o600,
    });
    await rename(temporary, dataFile);
    products = next;
  }
  function json(res, status, value) {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(JSON.stringify(value));
  }
  async function readBody(req) {
    if (
      (req.headers["content-type"] || "")
        .split(";", 1)[0]
        .trim()
        .toLowerCase() !== "application/json"
    )
      throw Object.assign(new Error("Нужен Content-Type application/json"), {
        status: 415,
      });
    if (Number(req.headers["content-length"]) > MAX_BODY)
      throw Object.assign(new Error("Слишком большой запрос"), { status: 413 });
    const parts = [];
    let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > MAX_BODY)
        throw Object.assign(new Error("Слишком большой запрос"), {
          status: 413,
        });
      parts.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(parts).toString("utf8"));
    } catch {
      throw Object.assign(new Error("Некорректный JSON"), { status: 400 });
    }
  }
  const server = http.createServer(async (req, res) => {
    try {
      const host = req.headers.host || "";
      if (!/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host))
        return json(res, 403, { error: "Разрешён только локальный адрес" });
      let pathname;
      try {
        pathname = decodeURIComponent(
          new URL(req.url, "http://" + host).pathname,
        );
      } catch {
        return json(res, 400, { error: "Некорректный URL" });
      }
      const mutation = !["GET", "HEAD", "OPTIONS"].includes(req.method);
      if (mutation) {
        const origin = req.headers.origin;
        if (
          (origin && origin !== "http://" + host) ||
          req.headers["sec-fetch-site"] === "cross-site"
        )
          return json(res, 403, {
            error: "Изменения разрешены только с этого локального сайта",
          });
      }
      if (pathname === "/api/health" && req.method === "GET")
        return json(res, 200, { ok: true, demo: true, storage: "local-file" });
      if (
        pathname === "/api/products" ||
        pathname.startsWith("/api/products/")
      ) {
        if (req.method === "GET" && pathname === "/api/products")
          return json(res, 200, {
            products,
            demo: true,
            storage: "local-file",
          });
        if (!["POST", "PUT", "DELETE"].includes(req.method))
          return json(res, 405, { error: "Метод не поддерживается" });
        const id = pathname.split("/")[3];
        if (
          (req.method === "POST" && pathname !== "/api/products") ||
          (req.method !== "POST" && (!id || pathname.split("/").length !== 4))
        )
          return json(res, 404, { error: "Маршрут не найден" });
        const input = req.method === "DELETE" ? null : await readBody(req);
        const operation = queue.then(async () => {
          const index = products.findIndex((p) => p.id === id);
          if (req.method === "DELETE") {
            if (index < 0) return json(res, 404, { error: "Товар не найден" });
            await persist(products.filter((p) => p.id !== id));
            return json(res, 200, { deleted: id, demo: true });
          }
          if (req.method === "PUT" && index < 0)
            return json(res, 404, { error: "Товар не найден" });
          if (req.method === "POST" && products.length >= 200)
            return json(res, 409, { error: "В демо не более 200 товаров" });
          if (req.method === "PUT" && input?.id !== id)
            return json(res, 422, { error: "ID товара нельзя менять" });
          const checked = validate(
            input,
            products.filter((p) => p.id !== id).map((p) => p.id),
          );
          if (!checked.value || Object.keys(checked.errors || {}).length)
            return json(res, 422, {
              error: "Проверьте поля товара",
              errors: checked.errors,
            });
          const next = [...products];
          if (req.method === "POST") next.push(checked.value);
          else next[index] = checked.value;
          await persist(next);
          return json(res, req.method === "POST" ? 201 : 200, {
            product: checked.value,
            demo: true,
          });
        });
        queue = operation.catch(() => {});
        await operation;
        return;
      }
      if (!["GET", "HEAD"].includes(req.method))
        return json(res, 405, { error: "Метод не поддерживается" });
      let relative =
        pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
      if (
        !allowedStatic.has(relative) &&
        !/^assets\/[a-zA-Z0-9_-]+\.(jpg|png|svg|webp)$/.test(relative)
      )
        return json(res, 404, { error: "Файл не найден" });
      const file = resolve(root, relative);
      if (!file.startsWith(resolve(root) + sep))
        return json(res, 403, { error: "Доступ запрещён" });
      let content;
      try {
        if (!(await stat(file)).isFile()) throw new Error();
        content = await readFile(file);
      } catch {
        return json(res, 404, { error: "Файл не найден" });
      }
      res.writeHead(200, {
        "Content-Type": MIME[extname(file)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : content);
    } catch (error) {
      if (!res.headersSent)
        json(res, error.status || 500, {
          error: error.status
            ? error.message
            : "Не удалось сохранить данные. Повторите действие.",
        });
      else res.end();
    }
  });
  return server;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const port = Number(process.env.PORT || 4191);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Некорректный PORT");
  const app = await createApp();
  app.listen(port, "127.0.0.1", () =>
    console.log(`ОБЪЕКТ — локальный демо-сервер: http://127.0.0.1:${port}/`),
  );
}
