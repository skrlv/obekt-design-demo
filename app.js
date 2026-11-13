import { products, money, sanitizeCart, cartTotals, selectProducts } from './catalog.mjs';

const $ = selector => document.querySelector(selector);
const key = 'obekt-demo-cart-v1';
const grid = $('#product-grid');
const productDialog = $('#product-dialog');
const cartDialog = $('#cart-dialog');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const activeAnimations = new Set();
let cart = {};
let storageAvailable = true;
let category = 'all';
let sort = 'default';
let lastProductTrigger = null;
let lastCartTrigger = null;
let toastTimer;

try {
  const raw = localStorage.getItem(key);
  cart = raw ? sanitizeCart(JSON.parse(raw)) : {};
} catch {
  storageAvailable = false;
}

function animate(element, frames, options) {
  if (reducedMotion.matches || !element?.animate) return;
  const animation = element.animate(frames, options);
  activeAnimations.add(animation);
  animation.finished.then(() => activeAnimations.delete(animation), () => activeAnimations.delete(animation));
}
reducedMotion.addEventListener('change', event => {
  if (event.matches) {
    for (const animation of activeAnimations) animation.finish();
    activeAnimations.clear();
  }
});

// Content is visible by default. Animation is progressive enhancement only.
const revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    revealObserver.unobserve(entry.target);
    const order = Number(entry.target.dataset.revealOrder || 0);
    animate(entry.target,
      [{ opacity: .35, transform: 'translateY(20px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 650, delay: Math.min(order, 3) * 55, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
  }
}, { threshold: .08 }) : null;
function observeReveals(elements) {
  if (!revealObserver || reducedMotion.matches) return;
  elements.forEach(element => revealObserver.observe(element));
}

function announce(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2800);
}
function saveCart() {
  if (storageAvailable) {
    try { localStorage.setItem(key, JSON.stringify(cart)); }
    catch { storageAvailable = false; }
  }
  renderCart();
}
function addToCart(id, trigger) {
  const product = products.find(product => product.id === id);
  if (!product) return;
  if ((cart[id] || 0) >= 20) {
    announce('В демо-корзине можно выбрать до 20 одинаковых предметов.');
    if (productDialog.open) $('.product-feedback').textContent = 'В корзине уже 20 таких предметов — это максимум для демо.';
    return;
  }
  cart[id] = (cart[id] || 0) + 1;
  saveCart();
  announce(`«${product.name}» — в вашей корзине`);
  if (productDialog.open) $('.product-feedback').textContent = `Добавлено. В корзине: ${cart[id]} шт.`;
  const cartToggle = $('[data-open-cart]');
  animate(cartToggle.querySelector('[data-cart-count]'),
    [{ transform: 'scale(1)' }, { transform: 'scale(1.22)' }, { transform: 'scale(1)' }],
    { duration: 350, easing: 'ease-out' });
  cartToggle.classList.add('is-added');
  if (trigger?.matches('.quick-add')) {
    trigger.textContent = '✓';
    trigger.classList.add('is-added');
    setTimeout(() => { trigger.textContent = '+'; trigger.classList.remove('is-added'); }, 1000);
  }
  setTimeout(() => cartToggle.classList.remove('is-added'), 1000);
}

function renderProducts() {
  const shown = selectProducts(category, sort);
  grid.querySelectorAll('.product-card').forEach(card => revealObserver?.unobserve(card));
  $('#result-count').textContent = `Объектов: ${shown.length}`;
  grid.innerHTML = shown.map((p, i) => `<article class="product-card" data-reveal-order="${i}">
    <div class="product-photo">
      <button class="product-image-button" data-product="${p.id}" aria-label="Рассмотреть ${p.type.toLowerCase()} «${p.name}»"><img src="assets/${p.image}" alt="${p.type} «${p.name}», иллюстративная фотография" loading="lazy" width="800" height="1000"></button>
      <span class="product-number">ОБЪЕКТ / ${String(products.indexOf(p) + 1).padStart(2, '0')}</span>
      <button class="quick-add" data-add="${p.id}" aria-label="Добавить «${p.name}» в корзину">+</button>
    </div>
    <div class="product-meta"><span>${p.type}</span><span>${p.color}</span></div>
    <div class="product-title"><h3><button data-product="${p.id}">${p.name}</button></h3><span>${money(p.price)}</span></div>
  </article>`).join('');
  observeReveals(grid.querySelectorAll('.product-card'));
}
function openProduct(id, trigger) {
  const p = products.find(product => product.id === id);
  if (!p) return;
  lastProductTrigger = trigger;
  $('#product-detail').innerHTML = `<div class="detail-photo"><img src="assets/${p.image}" alt="${p.type} «${p.name}», фотография-иллюстрация" width="800" height="1000"></div>
    <div class="detail-copy"><span class="eyebrow">${p.type} / КОЛЛЕКЦИЯ 01</span><h2 id="product-title">${p.name}</h2><p class="detail-description">${p.copy}</p>
      <dl><div><dt>Цвет</dt><dd>${p.color}</dd></div><div><dt>Размеры</dt><dd>${p.size}</dd></div><div><dt>Материалы</dt><dd>${p.material}</dd></div></dl>
      <p class="detail-price">${money(p.price)}</p><button class="button blue" data-add="${p.id}">Добавить в корзину <span aria-hidden="true">+</span></button><p class="product-feedback" role="status" aria-live="polite"></p>
      <p class="detail-disclaimer">Фотография — иллюстрация. Название, цена и характеристики условные. Это демонстрационная карточка.</p>
    </div>`;
  productDialog.showModal();
  productDialog.scrollTop = 0;
  $('[data-close-product]').focus({ preventScroll: true });
}

// A storage event can rerender an open cart. Remember the task's focused control.
function rememberCartFocus() {
  const active = document.activeElement;
  if (!cartDialog.open || !cartDialog.contains(active)) return null;
  if (active.matches('[data-quantity]')) return { type: 'quantity', id: active.dataset.quantity, delta: active.dataset.delta };
  if (active.matches('[data-remove]')) return { type: 'remove', id: active.dataset.remove };
  if (active.matches('[data-checkout], [data-back-cart]')) return { type: 'checkout' };
  return null;
}
function restoreCartFocus(focus) {
  if (!focus || !cartDialog.open) return;
  let target;
  if (focus.type === 'quantity') {
    target = cartDialog.querySelector(`[data-quantity="${focus.id}"][data-delta="${focus.delta}"]:not(:disabled)`)
      || cartDialog.querySelector(`[data-quantity="${focus.id}"][data-delta="-1"]`);
  } else if (focus.type === 'remove') target = cartDialog.querySelector(`[data-remove="${focus.id}"]`);
  else if (focus.type === 'checkout') target = cartDialog.querySelector('[data-checkout]');
  (target || cartDialog.querySelector('[data-close-cart]')).focus({ preventScroll: true });
}
function renderCart() {
  const focus = rememberCartFocus();
  const { count, total } = cartTotals(cart);
  document.querySelectorAll('[data-cart-count]').forEach(element => element.textContent = count);
  $('[data-open-cart]').setAttribute('aria-label', `Открыть корзину, товаров: ${count}`);
  $('#storage-note').hidden = storageAvailable;
  const chosen = products.filter(product => cart[product.id]);
  $('#cart-items').innerHTML = chosen.length ? chosen.map(p => `<article class="cart-item">
    <img src="assets/${p.image}" alt="${p.type} «${p.name}»" width="100" height="125">
    <div class="cart-item-info"><span class="eyebrow">${p.type}</span><h3>${p.name}</h3><span>${money(p.price)}</span>
      <div class="quantity"><button data-quantity="${p.id}" data-delta="-1" aria-label="Уменьшить количество «${p.name}»">−</button><span aria-label="Количество">${cart[p.id]}</span><button data-quantity="${p.id}" data-delta="1" ${cart[p.id] >= 20 ? 'disabled' : ''} aria-label="Увеличить количество «${p.name}»">+</button></div>
    </div>
    <div class="cart-item-end"><button data-remove="${p.id}" aria-label="Удалить «${p.name}» из корзины">×</button><strong>${money(p.price * cart[p.id])}</strong></div>
  </article>`).join('') : `<div class="empty-cart"><span aria-hidden="true">↗</span><h3>Здесь будет<br>ваша коллекция.</h3><p>Начните с предмета, который вам близок.</p><button class="button blue" data-continue>К коллекции <span aria-hidden="true">↗</span></button></div>`;
  $('#cart-bottom').innerHTML = chosen.length ? `<div class="subtotal"><span>Итого</span><strong>${money(total)}</strong></div><p class="cart-explainer">Стоимость условная. Доставка не рассчитывается.</p><button class="button blue checkout" data-checkout>Посмотреть демо-заказ <span aria-hidden="true">↗</span></button><p class="detail-disclaimer">Никаких списаний и отправки данных.</p>` : '';
  restoreCartFocus(focus);
}
function openCart(trigger) {
  lastCartTrigger = trigger;
  renderCart();
  cartDialog.showModal();
  cartDialog.scrollTop = 0;
  $('[data-close-cart]').focus({ preventScroll: true });
}

function showCheckout() {
  const { count, total } = cartTotals(cart);
  if (!count) return;
  $('#cart-bottom').innerHTML = `<div class="order-result" role="status"><span class="eyebrow">ДЕМО-СЦЕНАРИЙ ЗАВЕРШЁН</span><h3>Хороший выбор.</h3><p>В вашей подборке ${count} шт.<br>Условная стоимость: <strong>${money(total)}</strong>.</p><p>Это только просмотр заказа. Покупка не оформлена, данные не отправлены. Корзина остаётся у вас.</p><button class="text-link" data-back-cart>Вернуться к корзине ↗</button></div>`;
  cartDialog.querySelector('[data-back-cart]').focus();
}

document.addEventListener('click', event => {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.matches('[data-product]')) openProduct(target.dataset.product, target);
  if (target.matches('[data-add]')) addToCart(target.dataset.add, target);
  if (target.matches('[data-filter]')) {
    category = target.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button === target)));
    renderProducts();
  }
  if (target.matches('[data-open-cart]')) openCart(target);
  if (target.matches('[data-close-product]')) productDialog.close();
  if (target.matches('[data-close-cart]')) cartDialog.close();
  if (target.matches('[data-quantity]')) {
    const id = target.dataset.quantity;
    cart[id] = Math.max(0, Math.min(20, (cart[id] || 0) + Number(target.dataset.delta)));
    if (!cart[id]) delete cart[id];
    saveCart();
  }
  if (target.matches('[data-remove]')) {
    delete cart[target.dataset.remove];
    saveCart();
    announce('Объект удалён из корзины');
  }
  if (target.matches('[data-continue]')) {
    cartDialog.close();
    const heading = $('#collection-title');
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
    $('#collection').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  }
  if (target.matches('[data-checkout]')) showCheckout();
  if (target.matches('[data-back-cart]')) {
    renderCart();
    cartDialog.querySelector('[data-checkout]')?.focus();
  }
});
$('#sort').addEventListener('change', event => {
  sort = event.target.value;
  renderProducts();
});
for (const dialog of [productDialog, cartDialog]) {
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    const trigger = dialog === productDialog ? lastProductTrigger : lastCartTrigger;
    if (document.activeElement === $('#collection-title')) return;
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  });
}
window.addEventListener('storage', event => {
  if (event.key !== key && event.key !== null) return;
  try {
    const raw = event.key === null ? localStorage.getItem(key) : event.newValue;
    cart = raw ? sanitizeCart(JSON.parse(raw)) : {};
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  renderCart();
});

let scrollFrame = false;
function updateProgress() {
  const distance = document.documentElement.scrollHeight - innerHeight;
  $('.reading-progress').style.transform = `scaleX(${distance > 0 ? Math.min(1, Math.max(0, scrollY / distance)) : 0})`;
  scrollFrame = false;
}
window.addEventListener('scroll', () => {
  if (!scrollFrame) { scrollFrame = true; requestAnimationFrame(updateProgress); }
}, { passive: true });
window.addEventListener('resize', updateProgress, { passive: true });
renderProducts();
renderCart();
observeReveals(document.querySelectorAll('.hero-copy,.hero-art,.section-heading,.manifesto-grid,.editorial-grid,.faq,.footer-top'));
updateProgress();
