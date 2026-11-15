import {
  products as seed,
  money,
  escapeHTML as esc,
  validateProduct,
  normalizeProducts,
  selectProducts,
  sanitizeCart,
  cartTotals,
  variantKey,
  sanitizeIds,
  MAX_PRODUCTS,
} from "./catalog.mjs";
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const KEY = "obekt-studio-v2";
const palette = [
  { id: "ivory", label: "Слоновая кость", hex: "#e8e1d2" },
  { id: "graphite", label: "Графит", hex: "#3c3c38" },
  { id: "natural", label: "Натуральный", hex: "#b89a72" },
  { id: "green", label: "Зелёный", hex: "#526850" },
  { id: "gray", label: "Серый", hex: "#92948f" },
  { id: "blue", label: "Синий", hex: "#596b87" },
];
let catalog = structuredClone(seed),
  cart = [],
  favorites = [],
  compare = [],
  storageOK = true,
  backend = false;
let category = "all",
  sort = "default",
  favoritesOnly = false,
  currentProduct = null,
  selectedColor = "",
  selectedMaterial = "";
let toastTimer;
const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(
  location.hostname,
);
const backendRequested =
  localHost && new URLSearchParams(location.search).get("backend") === "1";
let backendError = "";
function announce(message) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 3500);
}
function load() {
  catalog = structuredClone(seed);
  cart = [];
  favorites = [];
  compare = [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!raw) return;
    if (Array.isArray(raw.catalog)) catalog = normalizeProducts(raw.catalog);
    cart = sanitizeCart(raw.cart, catalog);
    favorites = sanitizeIds(raw.favorites, catalog);
    compare = sanitizeIds(raw.compare, catalog, 4);
  } catch (error) {
    if (error instanceof SyntaxError) {
      announce("Сохранённые демоданные повреждены. Восстановлен исходный каталог.");
    } else storageOK = false;
  }
}
function save() {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ catalog, cart, favorites, compare }),
    );
  } catch {
    storageOK = false;
  }
  $("#storage-note").hidden = storageOK;
  $("#storage-warning").hidden = storageOK;
}
function clean() {
  cart = sanitizeCart(cart, catalog);
  favorites = sanitizeIds(favorites, catalog);
  compare = sanitizeIds(compare, catalog, 4);
}
function renderCounts() {
  const totals = cartTotals(cart, catalog);
  $$("[data-cart-count]").forEach((e) => (e.textContent = totals.count));
  $$("[data-fav-count]").forEach((e) => (e.textContent = favorites.length));
  $$("[data-compare-count]").forEach((e) => (e.textContent = compare.length));
  $("#compare-dock").hidden = !compare.length;
  $$("[data-favorites]").forEach((e) =>
    e.setAttribute("aria-pressed", String(favoritesOnly)),
  );
  $("[data-open-cart]").setAttribute(
    "aria-label",
    `Открыть корзину, товаров: ${totals.count}`,
  );
}
function populateFilters() {
  const oldM = $("#material-filter").value,
    oldC = $("#color-filter").value;
  const active = catalog.filter((p) => p.active);
  const mats = [...new Set(active.flatMap((p) => p.materials))];
  const colors = [
    ...new Map(active.flatMap((p) => p.colors).map((c) => [c.id, c])).values(),
  ];
  $("#material-filter").innerHTML =
    '<option value="">Любой материал</option>' +
    mats.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join("");
  $("#color-filter").innerHTML =
    '<option value="">Любой цвет</option>' +
    colors
      .map((c) => `<option value="${esc(c.id)}">${esc(c.label)}</option>`)
      .join("");
  $("#material-filter").value = mats.includes(oldM) ? oldM : "";
  $("#color-filter").value = colors.some((c) => c.id === oldC) ? oldC : "";
  const all = $('[data-filter="all"] sup');
  if (all) all.textContent = active.length;
}
function renderProducts() {
  const shown = selectProducts(
    category,
    sort,
    {
      query: $("#search").value,
      material: $("#material-filter").value,
      color: $("#color-filter").value,
      maxPrice:
        $("#max-price").value === ""
          ? undefined
          : Number($("#max-price").value),
      favorites,
      favoritesOnly,
    },
    catalog,
  );
  $("#result-count").textContent = `Объектов: ${shown.length}`;
  $("#favorites-state").hidden = !favoritesOnly;
  $("#product-grid").innerHTML = shown.length
    ? shown
        .map(
          (p) =>
            `<article class="product-card"><div class="product-photo"><button class="product-image-button" data-product="${esc(p.id)}" aria-label="Рассмотреть «${esc(p.name)}»"><img src="assets/${esc(p.image)}" alt="${esc(p.type)} «${esc(p.name)}», иллюстративная фотография" loading="lazy" width="800" height="1000"></button><span class="product-number">ОБЪЕКТ / ${String(catalog.indexOf(p) + 1).padStart(2, "0")}</span><button class="quick-add" data-product="${esc(p.id)}" aria-label="Выбрать отделку «${esc(p.name)}»">+</button></div><div class="product-meta"><span>${esc(p.type)}</span><span>${esc(p.materials.join(" / "))}</span></div><div class="product-title"><h3><button data-product="${esc(p.id)}">${esc(p.name)}</button></h3><span>${money(p.price)}</span></div><div class="card-swatches" aria-label="Демонстрационные цвета: ${esc(p.colors.map((c) => c.label).join(", "))}">${p.colors.map((c) => `<span class="swatch" style="--swatch:${c.hex}"></span>`).join("")}</div><div class="card-actions"><button class="heart" data-fav="${esc(p.id)}" aria-pressed="${favorites.includes(p.id)}" aria-label="${favorites.includes(p.id) ? "Убрать из избранного" : "В избранное"} «${esc(p.name)}»">${favorites.includes(p.id) ? "♥" : "♡"}</button><button data-compare="${esc(p.id)}" aria-pressed="${compare.includes(p.id)}">${compare.includes(p.id) ? "✓ В сравнении" : "⇄ Сравнить"}</button></div></article>`,
        )
        .join("")
    : `<div class="no-results"><h3>${favoritesOnly ? "Здесь будет ваша подборка." : "Пока нет совпадений."}</h3><p>${favoritesOnly ? "Отмечайте понравившиеся предметы сердечком." : "Попробуйте другую категорию или уберите часть фильтров."}</p><button class="text-link" data-reset-filters>Показать все объекты ↗</button></div>`;
  renderCounts();
}
function showDialog(id, trigger) {
  const dialog = $(id);
  dialog.returnFocus = trigger;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  dialog
    .querySelector("[data-close], [data-close-product], [data-close-cart]")
    ?.focus({ preventScroll: true });
}
function openProduct(id, trigger) {
  const p = catalog.find((p) => p.id === id && p.active);
  if (!p) {
    announce("Этот объект сейчас скрыт из каталога.");
    return;
  }
  currentProduct = id;
  selectedColor = p.colors[0].id;
  selectedMaterial = p.materials[0];
  $("#product-detail").innerHTML =
    `<div class="detail-photo"><img src="assets/${esc(p.image)}" alt="${esc(p.name)}, иллюстративная фотография" width="800" height="1000"></div><div class="detail-copy"><span class="eyebrow">${esc(p.type)} / КОЛЛЕКЦИЯ 01</span><h2 id="product-title">${esc(p.name)}</h2><p class="detail-description">${esc(p.copy)}</p><dl><div><dt>Размеры</dt><dd>${esc(p.size)}</dd></div><div><dt>Основа</dt><dd>${esc(p.material)}</dd></div></dl><div class="variant-field"><span>Демонстрационный цвет</span><div class="color-choices">${p.colors.map((c, i) => `<button data-color="${esc(c.id)}" aria-pressed="${i === 0}"><span class="swatch" style="--swatch:${c.hex}"></span>${esc(c.label)}</button>`).join("")}</div></div><label class="variant-field">Материал / отделка<select id="product-material">${p.materials.map((m) => `<option>${esc(m)}</option>`).join("")}</select></label><p class="variant-note">Варианты показывают работу выбора. Фото при смене цвета не меняется; изображение иллюстративное.</p><p class="detail-price">${money(p.price)}</p><button class="button blue" data-add="${esc(p.id)}">Добавить в корзину <span>+</span></button><p class="product-feedback" role="status" aria-live="polite"></p><p class="detail-disclaimer">Все названия, цены, отделки и размеры условные. Доставка и оплата не подключены.</p></div>`;
  showDialog("#product-dialog", trigger);
}
function add(id) {
  const p = catalog.find((p) => p.id === id && p.active);
  if (!p) return;
  if (
    !p.colors.some((c) => c.id === selectedColor) ||
    !p.materials.includes(selectedMaterial)
  ) {
    openProduct(id, $("#product-dialog").returnFocus);
    announce("Отделки объекта обновились. Выберите вариант ещё раз.");
    return;
  }
  const line = {
    id,
    color: selectedColor,
    material: selectedMaterial,
    quantity: 1,
  };
  const old = cart.find((l) => variantKey(l) === variantKey(line));
  if (old?.quantity >= 20) {
    announce("Максимум 20 предметов одной конфигурации.");
    return;
  }
  if (!old && cart.length >= 60) {
    announce("В демо-корзине уже 60 конфигураций.");
    return;
  }
  if (old) old.quantity++;
  else cart.push(line);
  save();
  renderCounts();
  renderCart();
  const text = `«${p.name}» добавлен. В корзине: ${cartTotals(cart, catalog).count} шт.`;
  announce(text);
  $(".product-feedback").textContent = text;
}
function renderCart() {
  const focus = document.activeElement?.dataset;
  const totals = cartTotals(cart, catalog);
  $("#storage-note").hidden = storageOK;
  $("#cart-items").innerHTML = cart.length
    ? cart
        .map((l) => {
          const p = catalog.find((p) => p.id === l.id);
          const key = esc(variantKey(l));
          return `<article class="cart-item"><img src="assets/${esc(p.image)}" alt="${esc(p.name)}" width="100" height="125"><div class="cart-item-info"><span class="eyebrow">${esc(p.type)}</span><h3>${esc(p.name)}</h3><span>${money(p.price)}</span><small>${esc(p.colors.find((c) => c.id === l.color).label)} / ${esc(l.material)}</small><div class="quantity"><button data-quantity="${key}" data-delta="-1" aria-label="Уменьшить количество «${esc(p.name)}»">−</button><span aria-label="Количество">${l.quantity}</span><button data-quantity="${key}" data-delta="1" aria-label="Увеличить количество «${esc(p.name)}»" ${l.quantity >= 20 ? "disabled" : ""}>+</button></div></div><div class="cart-item-end"><button data-remove="${key}" aria-label="Удалить «${esc(p.name)}»">×</button><strong>${money(p.price * l.quantity)}</strong></div></article>`;
        })
        .join("")
    : `<div class="empty-cart"><span>↗</span><h3>Здесь будет<br>ваша коллекция.</h3><p>Начните с предмета, который вам близок.</p><button class="button blue" data-continue>К коллекции ↗</button></div>`;
  $("#cart-bottom").innerHTML = cart.length
    ? `<div class="subtotal"><span>Итого</span><strong>${money(totals.total)}</strong></div><p class="cart-explainer">Тестовые цены. Доставка не рассчитывается. Оплата отключена.</p><button class="button blue checkout" data-checkout>Посмотреть демо-заказ ↗</button><p class="detail-disclaimer">Личные и платёжные данные не запрашиваются.</p>`
    : "";
  if ($("#cart-dialog").open && focus?.quantity) {
    const el = $$("[data-quantity]").find(
      (e) =>
        e.dataset.quantity === focus.quantity &&
        e.dataset.delta === focus.delta &&
        !e.disabled,
    );
    (el || $("[data-close-cart]")).focus();
  }
}
function renderCompare() {
  const chosen = compare
    .map((id) => catalog.find((p) => p.id === id))
    .filter(Boolean);
  if (!chosen.length) {
    $("#compare-content").innerHTML =
      '<div class="no-results"><h3>Что вам ближе?</h3><p>Добавьте до четырёх предметов кнопкой «Сравнить» в каталоге.</p></div>';
    return;
  }
  const row = (title, fn) =>
    `<tr><th scope="row">${title}</th>${chosen.map((p) => `<td>${fn(p)}</td>`).join("")}</tr>`;
  $("#compare-content").innerHTML =
    `<div class="compare-scroll" tabindex="0" aria-label="Таблица сравнения, можно прокрутить по горизонтали"><table class="compare-table"><caption class="sr-only">Демонстрационные характеристики выбранных предметов</caption><thead><tr><th scope="col">Объект</th>${chosen.map((p) => `<th scope="col"><img src="assets/${esc(p.image)}" alt="${esc(p.name)}, иллюстрация"><h3>${esc(p.name)}</h3><button class="text-link" data-compare="${esc(p.id)}">Убрать ×</button></th>`).join("")}</tr></thead><tbody>${row("Тип", (p) => esc(p.type))}${row("Цена", (p) => money(p.price))}${row("Размеры", (p) => esc(p.size))}${row("Материалы", (p) => esc(p.materials.join(" / ")))}${row("Цвета", (p) => esc(p.colors.map((c) => c.label).join(" / ")))}</tbody></table></div>`;
}
function resetFilters() {
  category = "all";
  sort = "default";
  favoritesOnly = false;
  $("#sort").value = "default";
  ["#search", "#material-filter", "#color-filter", "#max-price"].forEach(
    (s) => ($(s).value = ""),
  );
  $$("[data-filter]").forEach((e) =>
    e.setAttribute("aria-pressed", String(e.dataset.filter === "all")),
  );
  renderProducts();
}
function renderPanel() {
  $("#panel-mode").textContent = backend
    ? "Локальный сервер подключён: каталог сохраняется в файл на этом компьютере. Панель не имеет авторизации и предназначена только для локальной демонстрации."
    : "GitHub Pages / режим браузера: добавление, правки и удаление сохраняются только у вас. Это демонстрация панели, без серверной авторизации и реальных заказов." +
      (backendError ? " " + backendError : "");
  $("#panel-list").innerHTML = catalog.length
    ? catalog
        .map(
          (p) =>
            `<article class="panel-row ${p.active ? "" : "inactive"}"><img src="assets/${esc(p.image)}" alt="${esc(p.name)}"><div><h3>${esc(p.name)}</h3><p>${esc(p.type)} · ${p.active ? "В каталоге" : "Скрыт"}<br>${esc(p.materials.join(" / "))}</p></div><strong>${money(p.price)}</strong><div class="row-actions"><button data-edit="${esc(p.id)}">Изменить ↗</button><button data-delete="${esc(p.id)}">Удалить ×</button></div></article>`,
        )
        .join("")
    : '<p class="demo-note">Каталог пуст. Добавьте первый демонстрационный объект.</p>';
}
function editProduct(id) {
  const p = catalog.find((p) => p.id === id);
  const form = $("#product-form");
  form.reset();
  form.hidden = false;
  $("#edit-title").textContent = p ? "Изменить объект" : "Новый объект";
  for (const name of [
    "id",
    "name",
    "type",
    "category",
    "price",
    "image",
    "size",
    "copy",
  ])
    form.elements[name].value =
      p?.[name] ??
      (name === "category" ? "seating" : name === "image" ? "chair.jpg" : "");
  form.elements.materials.value = p?.materials.join(", ") || "";
  form.elements.active.checked = p?.active ?? true;
  const editorPalette = [
    ...new Map(
      [...palette, ...(p?.colors || [])].map((c) => [c.id, c]),
    ).values(),
  ];
  $("#editor-colors").innerHTML = editorPalette
    .map(
      (c, i) =>
        `<label><input type="checkbox" name="colors" value="${esc(c.id)}" data-label="${esc(c.label)}" data-hex="${c.hex}" ${p ? (p.colors.some((x) => x.id === c.id) ? "checked" : "") : i === 0 ? "checked" : ""}><span class="swatch" style="--swatch:${c.hex}"></span>${esc(c.label)}</label>`,
    )
    .join("");
  $("#form-errors").textContent = "";
  form.scrollIntoView({ behavior: "instant", block: "start" });
  form.elements.name.focus({ preventScroll: true });
}
async function request(path, method, body) {
  const response = await fetch(`./api/products${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const e = await response.json().catch(() => ({}));
    throw new Error(e.error || `Сервер ответил ${response.status}`);
  }
  return response.status === 204 ? null : response.json();
}
function changed() {
  clean();
  save();
  populateFilters();
  renderProducts();
  renderCart();
  renderCompare();
  renderPanel();
}
$("#product-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const f = event.currentTarget;
  const id = f.elements.id.value;
  const colors = [...f.querySelectorAll("[name=colors]:checked")].map((e) => ({
    id: e.value,
    label: e.dataset.label,
    hex: e.dataset.hex,
  }));
  const raw = {
    id: id || `obj-${crypto.randomUUID().slice(0, 8)}`,
    name: f.elements.name.value.trim(),
    type: f.elements.type.value.trim(),
    category: f.elements.category.value,
    price: Number(f.elements.price.value),
    image: f.elements.image.value,
    size: f.elements.size.value.trim(),
    copy: f.elements.copy.value.trim(),
    materials: f.elements.materials.value
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    colors,
    active: f.elements.active.checked,
  };
  const check = validateProduct(
    raw,
    catalog.filter((p) => p.id !== id).map((p) => p.id),
  );
  if (!id && catalog.length >= MAX_PRODUCTS) {
    $("#form-errors").textContent =
      `В демо-каталоге не более ${MAX_PRODUCTS} объектов. Удалите один из существующих.`;
    return;
  }
  if (!check.value) {
    $("#form-errors").textContent = Object.values(check.errors).join(". ");
    return;
  }
  const submit = f.querySelector("[type=submit]");
  submit.disabled = true;
  try {
    if (backend)
      await request(
        id ? `/${encodeURIComponent(id)}` : "",
        id ? "PUT" : "POST",
        check.value,
      );
    if (id) catalog = catalog.map((p) => (p.id === id ? check.value : p));
    else catalog.push(check.value);
    f.hidden = true;
    changed();
    (
      $$("[data-edit]").find((b) => b.dataset.edit === check.value.id) ||
      $("[data-new]")
    ).focus({ preventScroll: true });
    announce(
      "Объект сохранён" +
        (backend ? " на локальном сервере." : " в этом браузере."),
    );
  } catch (e) {
    $("#form-errors").textContent = `Не удалось сохранить: ${e.message}`;
  } finally {
    submit.disabled = false;
  }
});
document.addEventListener("click", async (event) => {
  const t = event.target.closest("button");
  if (!t) return;
  if (t.matches("[data-product]")) openProduct(t.dataset.product, t);
  if (t.matches("[data-add]")) add(t.dataset.add);
  if (t.matches("[data-color]")) {
    selectedColor = t.dataset.color;
    $$("[data-color]").forEach((b) =>
      b.setAttribute("aria-pressed", String(b === t)),
    );
  }
  if (t.matches("[data-filter]")) {
    category = t.dataset.filter;
    $$("[data-filter]").forEach((b) =>
      b.setAttribute("aria-pressed", String(b === t)),
    );
    renderProducts();
  }
  if (t.matches("[data-reset-filters]")) resetFilters();
  if (t.matches("[data-fav]")) {
    const id = t.dataset.fav;
    if (!favorites.includes(id) && favorites.length >= 100) {
      announce("В избранном может быть до 100 объектов.");
      return;
    }
    favorites = favorites.includes(id)
      ? favorites.filter((v) => v !== id)
      : [...favorites, id];
    save();
    renderProducts();
    const b = $$("[data-fav]").find((b) => b.dataset.fav === id);
    (b || $(".header [data-favorites]")).focus({ preventScroll: true });
  }
  if (t.matches("[data-favorites]")) {
    favoritesOnly = !favoritesOnly;
    renderProducts();
    $("#collection").scrollIntoView({ behavior: "instant" });
  }
  if (t.matches("[data-compare]")) {
    const id = t.dataset.compare;
    if (compare.includes(id)) compare = compare.filter((x) => x !== id);
    else if (compare.length < 4) compare.push(id);
    else {
      announce(
        "Можно сравнить до четырёх предметов. Уберите один из выбранных.",
      );
      return;
    }
    save();
    renderProducts();
    renderCompare();
    if ($("#compare-dialog").open)
      $("#compare-dialog [data-close]").focus({ preventScroll: true });
    else
      $$("[data-compare]")
        .find((b) => b.dataset.compare === id)
        ?.focus({ preventScroll: true });
  }
  if (t.matches("[data-compare-open]")) {
    renderCompare();
    showDialog("#compare-dialog", t);
  }
  if (t.matches("[data-clear-compare]")) {
    compare = [];
    save();
    renderProducts();
    renderCompare();
    $(".header [data-compare-open]").focus({ preventScroll: true });
  }
  if (t.matches("[data-open-cart]")) {
    renderCart();
    showDialog("#cart-dialog", t);
  }
  if (t.matches("[data-close-product]")) $("#product-dialog").close();
  if (t.matches("[data-close-cart]")) $("#cart-dialog").close();
  if (t.matches("[data-close]")) t.closest("dialog").close();
  if (t.matches("[data-quantity]")) {
    const l = cart.find((l) => variantKey(l) === t.dataset.quantity);
    if (l)
      l.quantity = Math.max(
        0,
        Math.min(20, l.quantity + Number(t.dataset.delta)),
      );
    cart = cart.filter((l) => l.quantity > 0);
    save();
    renderCart();
    renderCounts();
  }
  if (t.matches("[data-remove]")) {
    cart = cart.filter((l) => variantKey(l) !== t.dataset.remove);
    save();
    renderCart();
    renderCounts();
    $("[data-close-cart]").focus();
  }
  if (t.matches("[data-continue]")) {
    $("#cart-dialog").close();
    $("#collection").scrollIntoView({ behavior: "instant" });
  }
  if (t.matches("[data-checkout]")) {
    const v = cartTotals(cart, catalog);
    $("#cart-bottom").innerHTML =
      `<div class="order-result" role="status"><span class="eyebrow">ДЕМО-СЦЕНАРИЙ ЗАВЕРШЁН</span><h3>Ваш выбор собран.</h3><p>В подборке ${v.count} шт. / ${money(v.total)}</p><p>Это тестовый просмотр. Заказ не создан, деньги не списаны. Корзина сохранена. Оплата и доставка не подключены.</p><button class="text-link" data-back-cart>Вернуться к корзине ↗</button></div>`;
    $("[data-back-cart]").focus();
  }
  if (t.matches("[data-back-cart]")) {
    renderCart();
    $("[data-checkout]")?.focus();
  }
  if (t.matches("[data-panel]")) {
    renderPanel();
    $("#product-form").hidden = true;
    showDialog("#panel-dialog", t);
  }
  if (t.matches("[data-new]")) editProduct();
  if (t.matches("[data-edit]")) editProduct(t.dataset.edit);
  if (t.matches("[data-cancel-edit]")) {
    $("#product-form").hidden = true;
    $("[data-new]").focus();
  }
  if (t.matches("[data-delete]")) {
    const p = catalog.find((p) => p.id === t.dataset.delete);
    if (
      !p ||
      !confirm(
        `Удалить демонстрационный объект «${p.name}»? Его позиции будут убраны из корзины и подборок.`,
      )
    )
      return;
    try {
      if (backend) await request(`/${encodeURIComponent(p.id)}`, "DELETE");
      catalog = catalog.filter((v) => v.id !== p.id);
      $("#product-form").hidden = true;
      changed();
      $("[data-new]").focus({ preventScroll: true });
      announce("Демонстрационный объект удалён.");
    } catch (e) {
      announce(`Ошибка удаления: ${e.message}`);
    }
  }
  if (t.matches("[data-export]")) {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ demo: true, products: catalog }, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "obekt-demo-catalog.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (t.matches("[data-reset-catalog]")) {
    if (backend) {
      announce(
        "В серверном режиме сброс доступен удалением server/data/products.json при остановленном сервере.",
      );
      return;
    }
    if (
      confirm(
        "Вернуть исходные шесть демо-объектов? Ваши правки каталога будут удалены.",
      )
    ) {
      catalog = structuredClone(seed);
      $("#product-form").hidden = true;
      changed();
      announce("Демонстрационный каталог восстановлен.");
    }
  }
});
["#search", "#max-price"].forEach((s) =>
  $(s).addEventListener("input", renderProducts),
);
["#material-filter", "#color-filter"].forEach((s) =>
  $(s).addEventListener("change", renderProducts),
);
$("#sort").addEventListener("change", (e) => {
  sort = e.target.value;
  renderProducts();
});
document.addEventListener("change", (e) => {
  if (e.target.id === "product-material") selectedMaterial = e.target.value;
});
$$("dialog").forEach((d) => {
  d.addEventListener("click", (e) => {
    if (e.target !== d) return;
    const b = d.getBoundingClientRect();
    if (
      e.clientX < b.left ||
      e.clientX > b.right ||
      e.clientY < b.top ||
      e.clientY > b.bottom
    )
      d.close();
  });
  d.addEventListener("close", () => {
    const target = d.returnFocus?.isConnected
      ? d.returnFocus
      : $("[data-filter=all]");
    target?.focus({ preventScroll: true });
  });
});
window.addEventListener("storage", (e) => {
  if (e.key !== KEY && e.key !== null) return;
  if (backend) return;
  const previousCatalog = JSON.stringify(catalog);
  load();
  clean();
  populateFilters();
  renderProducts();
  renderCart();
  renderCompare();
  if (previousCatalog !== JSON.stringify(catalog)) {
    if ($("#product-dialog").open) $("#product-dialog").close();
    $("#product-form").hidden = true;
    announce("Каталог обновлён в другой вкладке. Откройте объект заново.");
  }
  if ($("#panel-dialog").open) renderPanel();
});
load();
const warning = document.createElement("div");
warning.id = "storage-warning";
warning.className = "local-warning";
warning.hidden = storageOK;
warning.textContent =
  "Хранилище браузера недоступно. Подборки и изменения работают до перезагрузки страницы.";
$(".demo-banner").after(warning);
if (backendRequested) {
  try {
    const res = await request("", "GET");
    const raw = Array.isArray(res) ? res : res.products;
    if (!Array.isArray(raw)) throw new Error("неверный формат каталога");
    catalog = normalizeProducts(raw);
    backend = true;
  } catch {
    backendError =
      "Локальный сервер недоступен; используется сохранение в браузере.";
    announce(backendError);
  }
}
clean();
populateFilters();
renderProducts();
renderCart();
save();
