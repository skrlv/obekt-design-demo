const seed = [
  {
    id: "soft",
    name: "Мягкая линия",
    type: "Кресло",
    category: "seating",
    price: 32500,
    image: "chair.jpg",
    color: "Слоновая кость",
    material: "Демонстрация: тканевая обивка, деревянный каркас",
    size: "72 × 76 × 82 см",
    copy: "Мягкий силуэт и светлая фактура для того самого уголка, где можно замедлиться.",
  },
  {
    id: "contour",
    name: "Контур",
    type: "Стул",
    category: "seating",
    price: 18900,
    image: "lounge.jpg",
    color: "Серый / натуральный",
    material: "Демонстрация: текстиль, дерево",
    size: "58 × 57 × 81 см",
    copy: "Плавная линия спинки, мягкое сиденье и тёплый оттенок дерева. Для долгих разговоров за столом.",
  },
  {
    id: "circle",
    name: "Общий круг",
    type: "Обеденный стол",
    category: "tables",
    price: 44900,
    image: "table.jpg",
    color: "Белый / натуральный",
    material: "Демонстрация: окрашенная столешница, деревянные ножки",
    size: "Ø 100 × 74 см",
    copy: "Круглая форма, которая собирает людей. Для утреннего кофе, вечерних ужинов и повседневной жизни.",
  },
  {
    id: "arc",
    name: "Арка",
    type: "Стул",
    category: "seating",
    price: 14500,
    image: "chair-wood.jpg",
    color: "Графит / натуральный",
    material: "Демонстрация: формованный полимер, дерево",
    size: "48 × 53 × 82 см",
    copy: "Точный графичный акцент. Контраст чёрного силуэта и натуральных ножек оживляет спокойное пространство.",
  },
  {
    id: "ray",
    name: "Луч",
    type: "Напольный светильник",
    category: "light",
    price: 21900,
    image: "shelf.jpg",
    color: "Матовый чёрный",
    material: "Демонстрация: окрашенный металл",
    size: "Высота 145 см, плафон Ø 20 см",
    copy: "Локальный свет и выразительный изгиб. Лаконичный объект для чтения и тихих вечеров.",
  },
  {
    id: "horizon",
    name: "Горизонт",
    type: "Диван",
    category: "seating",
    price: 89500,
    image: "sofa.jpg",
    color: "Глубокий зелёный",
    material: "Демонстрация: велюр, деревянные опоры",
    size: "210 × 88 × 82 см",
    copy: "Глубокий цвет и спокойная горизонталь. Центр притяжения гостиной, где всем находится место.",
  },
];

// Every name, price, dimension and finish below is demonstration data.
const finishes = {
  soft: {
    materials: ["Ткань", "Букле"],
    colors: [
      { id: "ivory", label: "Слоновая кость", hex: "#e4dfd3" },
      { id: "sand", label: "Песочный", hex: "#b9a58b" },
      { id: "graphite", label: "Графит", hex: "#4e514f" },
    ],
  },
  contour: {
    materials: ["Текстиль", "Лён"],
    colors: [
      { id: "grey", label: "Серый", hex: "#a1a3a0" },
      { id: "sand", label: "Песочный", hex: "#b9a58b" },
    ],
  },
  circle: {
    materials: ["Дерево", "Шпон"],
    colors: [
      { id: "white", label: "Белый", hex: "#f1eee6" },
      { id: "oak", label: "Натуральный дуб", hex: "#baa280" },
    ],
  },
  arc: {
    materials: ["Полимер", "Дерево"],
    colors: [
      { id: "graphite", label: "Графит", hex: "#4e514f" },
      { id: "ivory", label: "Слоновая кость", hex: "#e4dfd3" },
      { id: "terracotta", label: "Терракота", hex: "#ac6f54" },
    ],
  },
  ray: {
    materials: ["Металл", "Латунь"],
    colors: [
      { id: "black", label: "Матовый чёрный", hex: "#303432" },
      { id: "brass", label: "Латунный", hex: "#b9a15f" },
    ],
  },
  horizon: {
    materials: ["Велюр", "Ткань"],
    colors: [
      { id: "green", label: "Глубокий зелёный", hex: "#526a54" },
      { id: "sand", label: "Песочный", hex: "#b9a58b" },
      { id: "graphite", label: "Графит", hex: "#4e514f" },
    ],
  },
};
export const products = seed.map((product) => ({
  ...product,
  ...finishes[product.id],
  active: true,
}));
export const MAX_PRODUCTS = 200;
export const money = (value) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );

const categories = new Set(["seating", "tables", "light"]);
const images = new Set([
  "chair.jpg",
  "lounge.jpg",
  "table.jpg",
  "chair-wood.jpg",
  "shelf.jpg",
  "sofa.jpg",
  "interior.jpg",
]);
const validId = (value) =>
  typeof value === "string" && /^[a-z][a-z0-9-]{0,47}$/.test(value);
const isRecord = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const validText = (value, min, max) =>
  typeof value === "string" &&
  value.trim().length >= min &&
  value.trim().length <= max &&
  !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);

/** Shared validation for the browser editor, saved data and optional local API. */
export function validateProduct(input, existingIds = []) {
  const errors = {};
  if (!isRecord(input))
    return { value: null, errors: { product: "Товар должен быть объектом." } };
  const value = {};
  if (!validId(input.id))
    errors.id =
      "Идентификатор: латинская буква, затем буквы, цифры или дефис; до 48 символов.";
  else if (new Set(existingIds).has(input.id))
    errors.id = "Такой идентификатор уже существует.";
  else value.id = input.id;
  for (const [field, min, max] of [
    ["name", 1, 100],
    ["type", 1, 60],
    ["size", 1, 160],
    ["copy", 1, 1200],
  ]) {
    if (!validText(input[field], min, max))
      errors[field] = `Введите от ${min} до ${max} символов.`;
    else value[field] = input[field].trim();
  }
  if (!categories.has(input.category))
    errors.category = "Выберите категорию: seating, tables или light.";
  else value.category = input.category;
  if (
    !Number.isInteger(input.price) ||
    input.price < 1 ||
    input.price > 10000000
  )
    errors.price = "Укажите целую тестовую цену от 1 до 10 000 000 ₽.";
  else value.price = input.price;
  if (!images.has(input.image))
    errors.image = "Выберите одну из локальных фотографий проекта.";
  else value.image = input.image;
  if (
    !Array.isArray(input.materials) ||
    input.materials.length < 1 ||
    input.materials.length > 8 ||
    input.materials.some((item) => !validText(item, 1, 60))
  ) {
    errors.materials = "Укажите от 1 до 8 материалов, каждый до 60 символов.";
  } else {
    value.materials = [...new Set(input.materials.map((item) => item.trim()))];
  }
  if (
    !Array.isArray(input.colors) ||
    input.colors.length < 1 ||
    input.colors.length > 8 ||
    input.colors.some(
      (item) =>
        !isRecord(item) ||
        !validId(item.id) ||
        !validText(item.label, 1, 60) ||
        typeof item.hex !== "string" ||
        !/^#[0-9a-fA-F]{6}$/.test(item.hex),
    )
  ) {
    errors.colors =
      "Укажите от 1 до 8 цветов с id, названием и шестизначным HEX.";
  } else if (
    new Set(input.colors.map((item) => item.id)).size !== input.colors.length
  ) {
    errors.colors = "Идентификаторы цветов должны быть уникальными.";
  } else {
    value.colors = input.colors.map((item) => ({
      id: item.id,
      label: item.label.trim(),
      hex: item.hex.toLowerCase(),
    }));
  }
  const materialSummary = value.materials?.join(", ") ?? "";
  for (const [field, fallback] of [
    ["color", value.colors?.[0]?.label],
    [
      "material",
      materialSummary.length > 240
        ? value.materials.slice(0, 3).join(", ") + "…"
        : materialSummary,
    ],
  ]) {
    const candidate = input[field] === undefined ? fallback : input[field];
    if (!validText(candidate, 1, 240))
      errors[field] = "Введите описание от 1 до 240 символов.";
    else value[field] = candidate.trim();
  }
  if (input.active !== undefined && typeof input.active !== "boolean")
    errors.active = "Статус товара должен быть логическим значением.";
  else value.active = input.active ?? true;
  return { value: Object.keys(errors).length ? null : value, errors };
}

/** Invalid records are dropped; the caller decides when to offer a seed reset. */
export function normalizeProducts(raw) {
  if (!Array.isArray(raw)) return [];
  const result = [];
  const ids = new Set();
  for (const item of raw.slice(0, MAX_PRODUCTS)) {
    const { value } = validateProduct(item, ids);
    if (value) {
      result.push(value);
      ids.add(value.id);
    }
  }
  return result;
}

const fold = (value) =>
  String(value ?? "")
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .trim();
export function selectProducts(
  category = "all",
  sort = "default",
  options = {},
  catalog = products,
) {
  const query = fold(options.query);
  const favoriteIds = new Set(options.favorites ?? []);
  const hasLimit =
    options.maxPrice !== undefined &&
    options.maxPrice !== null &&
    options.maxPrice !== "" &&
    Number.isFinite(Number(options.maxPrice));
  const result = catalog.filter(
    (product) =>
      product.active !== false &&
      (category === "all" || product.category === category) &&
      (!query || fold(`${product.name} ${product.type}`).includes(query)) &&
      (!options.material ||
        options.material === "all" ||
        product.materials.includes(options.material)) &&
      (!options.color ||
        options.color === "all" ||
        product.colors.some(
          (color) =>
            color.id === options.color || color.label === options.color,
        )) &&
      (!hasLimit || product.price <= Number(options.maxPrice)) &&
      (!options.favoritesOnly || favoriteIds.has(product.id)),
  );
  if (sort === "asc") result.sort((a, b) => a.price - b.price);
  if (sort === "desc") result.sort((a, b) => b.price - a.price);
  if (sort === "name")
    result.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  return result;
}

export function sanitizeIds(value, catalog = products, max = 100) {
  if (!Array.isArray(value)) return [];
  const known = new Set(
    catalog
      .filter((product) => product.active !== false)
      .map((product) => product.id),
  );
  return [
    ...new Set(value.filter((id) => typeof id === "string" && known.has(id))),
  ].slice(0, Math.max(0, Math.min(100, Math.trunc(max) || 0)));
}

export const variantKey = (line) =>
  `${line.id}|${encodeURIComponent(line.color)}|${encodeURIComponent(line.material)}`;

/** A cart line always identifies an available finish; client-stored prices are ignored. */
export function sanitizeCart(raw, catalog = products) {
  if (!Array.isArray(raw)) return [];
  const known = new Map(
    catalog
      .filter((product) => product.active !== false)
      .map((product) => [product.id, product]),
  );
  const result = new Map();
  for (const line of raw.slice(0, 600)) {
    if (
      !isRecord(line) ||
      !Number.isInteger(line.quantity) ||
      line.quantity <= 0
    )
      continue;
    const product = known.get(line.id);
    if (
      !product ||
      !product.colors.some((color) => color.id === line.color) ||
      !product.materials.includes(line.material)
    )
      continue;
    const clean = {
      id: product.id,
      color: line.color,
      material: line.material,
      quantity: Math.min(20, line.quantity),
    };
    const key = variantKey(clean);
    if (result.has(key))
      result.get(key).quantity = Math.min(
        20,
        result.get(key).quantity + clean.quantity,
      );
    else if (result.size < 60) result.set(key, clean);
  }
  return [...result.values()];
}

export function cartTotals(value, catalog = products) {
  const known = new Map(catalog.map((product) => [product.id, product]));
  return sanitizeCart(value, catalog).reduce(
    (sum, line) => ({
      count: sum.count + line.quantity,
      total: sum.total + known.get(line.id).price * line.quantity,
    }),
    { count: 0, total: 0 },
  );
}
