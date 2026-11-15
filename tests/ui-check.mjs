import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// The same checks can use a supplied browser page or their own Chromium process.
export async function runChecks(page, baseURL, outputDirectory) {
  const results = [];
  const errors = [];
  const onError = e => errors.push(e.message);
  const onDialog = d => d.accept();
  page.on('pageerror', onError);
  page.on('dialog', onDialog);
  const check = (name, condition) => {
    assert.ok(condition, name);
    results.push(name);
  };
  const count = () => page.locator('.product-card').count();
  const reset = () => page.locator('[data-reset-filters]').first().click();
  const close = () => page.keyboard.press('Escape');
  const openPanel = () => page.locator('[data-panel]:visible').first().click();
  const form = page.locator('#product-form');
  let other;
  try {
    await page.goto(baseURL);
    await page.evaluate(() => localStorage.removeItem('obekt-studio-v2'));
    await page.reload();
    await page.locator('.product-card').last().waitFor();
    check('Release 2.0.0 and six products', await count() === 6 && await page.locator('meta[name=application-version]').getAttribute('content') === '2.0.0');
    await page.locator('[data-filter=seating]').click();
    check('Category filter', await count() === 4);
    await page.locator('#material-filter').selectOption('Ткань');
    await page.locator('#color-filter').selectOption('graphite');
    await page.locator('#max-price').fill('40000');
    await page.locator('#search').fill('кресло');
    check('Combined material, color, price and search', await count() === 1 && await page.locator('.product-title h3').textContent() === 'Мягкая линия');
    await page.locator('#search').fill('несуществующий предмет');
    check('No search matches', await count() === 0 && await page.locator('#product-grid .no-results').isVisible());
    await reset();
    await page.locator('#sort').selectOption('asc');
    check('Price sorting', await page.locator('.product-title h3').first().textContent() === 'Арка');
    await reset();
    await page.locator('[data-fav=soft]').click();
    await page.locator('.header [data-favorites]').click();
    check('Favorites filter', await count() === 1);
    await page.locator('[data-fav=soft]').click();
    check('Empty favorites and focus recovery', await count() === 0 && await page.evaluate(() => document.activeElement.matches('.header [data-favorites]')));
    await page.locator('.header [data-favorites]').click();
    await page.locator('[data-fav=soft]').click();
    for (const id of ['soft', 'contour', 'circle', 'arc', 'ray']) await page.locator(`[data-compare=${id}]`).click();
    check('Comparison limited to four', await page.locator('.header [data-compare-count]').textContent() === '4');
    await page.locator('.header [data-compare-open]').click();
    check('Comparison has four columns and characteristics', await page.locator('.compare-table thead th').count() === 5 && await page.locator('.compare-table tbody tr').count() === 5);
    for (const id of ['soft', 'contour', 'circle', 'arc']) await page.locator(`#compare-dialog [data-compare=${id}]`).click();
    check('Empty comparison', await page.locator('#compare-content .no-results').isVisible());
    await close();
    await page.locator('.product-title [data-product=soft]').click();
    await page.locator('[data-color=sand]').click();
    await page.locator('#product-material').selectOption('Букле');
    await page.locator('[data-add=soft]').click();
    await page.locator('[data-color=ivory]').click();
    await page.locator('#product-material').selectOption('Ткань');
    await page.locator('[data-add=soft]').click();
    await close();
    await page.locator('[data-open-cart]').click();
    check('Distinct finishes remain separate', await page.locator('.cart-item').count() === 2 && (await page.locator('.cart-item small').first().textContent()).includes('Песочный / Букле'));
    await page.locator('[data-quantity][data-delta="1"]').first().click();
    check('Cart quantity and accurate total', (await page.locator('.subtotal strong').textContent()).replace(/\D/g, '') === '97500');
    await page.locator('[data-checkout]').click();
    check('Test checkout preserves cart and never requests payment data', (await page.locator('.order-result').textContent()).includes('Заказ не создан') && await page.locator('#cart-dialog input').count() === 0);
    await close();
    await page.reload();
    check('Reload preserves cart and favorites', await page.locator('.header [data-cart-count]').textContent() === '3' && await page.locator('.header [data-fav-count]').textContent() === '1');
    await openPanel();
    await page.locator('[data-new]').click();
    await form.locator('[name=name]').fill('Тест <b>свет</b>');
    await form.locator('[name=type]').fill('Светильник');
    await form.locator('[name=category]').selectOption('light');
    await form.locator('[name=price]').fill('23000');
    await form.locator('[name=size]').fill('40 × 20 см');
    await form.locator('[name=materials]').fill('Тестовый металл');
    await form.locator('[name=copy]').fill('Условный объект проверки панели, без наличия и продаж.');
    await form.locator('button[type=submit]').click();
    await form.waitFor({state:'hidden'});
    const newId = await page.locator('.panel-row').filter({hasText:'Тест <b>свет</b>'}).locator('[data-edit]').getAttribute('data-edit');
    check('Create product, escape user text and restore focus', Boolean(newId) && await page.locator('.panel-row h3 b').count() === 0 && await page.evaluate(id => document.activeElement.dataset.edit === id,newId));
    const downloadPromise = page.waitForEvent('download');
    await page.locator('[data-export]').click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    let exported = '';
    for await (const chunk of stream) exported += chunk;
    check('Export valid demonstration catalogue JSON', JSON.parse(exported).demo === true && JSON.parse(exported).products.length === 7);
    await page.locator(`[data-edit="${newId}"]`).click();
    await form.locator('[name=price]').fill('24000');
    await form.locator('[name=active]').uncheck();
    await form.locator('button[type=submit]').click();
    await form.waitFor({state:'hidden'});
    check('Edit price and hide product', (await page.locator(`[data-edit="${newId}"]`).locator('xpath=ancestor::article').textContent()).includes('Скрыт'));
    await close();
    check('Hidden product excluded from storefront', await count() === 6);
    await page.reload();
    await openPanel();
    check('Catalogue edits survive reload', await page.locator(`[data-edit="${newId}"]`).count() === 1);
    await page.locator(`[data-delete="${newId}"]`).click();
    check('Delete product', await page.locator('.panel-row').count() === 6);
    await close();
    // Regression: an open detail must not keep a variant removed by another tab.
    other = await page.context().newPage();
    await other.goto(baseURL);
    await page.locator('.product-title [data-product=soft]').click();
    await page.locator('[data-color=sand]').click();
    await other.evaluate(() => {
      const key='obekt-studio-v2'; const data=JSON.parse(localStorage.getItem(key));
      data.catalog[0].colors=data.catalog[0].colors.filter(c=>c.id!=='sand');
      localStorage.setItem(key,JSON.stringify(data));
    });
    await page.locator('#product-dialog').waitFor({state:'hidden'});
    check('Cross-tab catalogue changes close stale detail safely', await page.locator('.header [data-cart-count]').textContent() === '1');
    await other.evaluate(() => localStorage.clear());
    await page.waitForFunction(() => document.querySelector('.header [data-cart-count]').textContent === '0');
    check('Cross-tab clear resets catalogue and selections', await count() === 6 && await page.locator('.header [data-fav-count]').textContent() === '0');
    await other.evaluate(() => localStorage.setItem('obekt-studio-v2',JSON.stringify({catalog:[],cart:[],favorites:[],compare:[]})));
    await page.waitForFunction(() => document.querySelectorAll('.product-card').length === 0);
    check('Deliberately empty catalogue', await page.locator('#product-grid .no-results').isVisible());
    await openPanel();
    check('Empty product panel', (await page.locator('#panel-list').textContent()).includes('Каталог пуст'));
    await page.locator('[data-reset-catalog]').click();
    await close();
    await other.close(); other=undefined;
    await page.locator('.product-title [data-product=soft]').focus();
    await page.keyboard.press('Enter');
    for(let i=0;i<16;i++) await page.keyboard.press('Tab');
    check('Keyboard focus stays inside native dialog', await page.evaluate(() => Boolean(document.activeElement.closest('#product-dialog'))));
    await close();
    check('Escape returns focus to product trigger', await page.evaluate(() => document.activeElement.matches('.product-title [data-product=soft]')));
    await page.emulateMedia({reducedMotion:'reduce'});
    check('Reduced motion disables dialog animation', await page.locator('#product-dialog').evaluate(e => getComputedStyle(e).animationName === 'none'));
    await page.reload(); await page.locator('.product-card').last().waitFor();
    if(outputDirectory) await mkdir(outputDirectory,{recursive:true});
    for(const width of [320,390,768,1440]) {
      await page.setViewportSize({width,height:width<500?844:1000});
      await page.evaluate(() => scrollTo(0,0));
      check(`No page overflow at ${width}px`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if(outputDirectory && [390,1440].includes(width)) await page.screenshot({path:resolve(outputDirectory,width===390?'mobile-preview.png':'desktop-preview.png')});
    }
    await page.locator('#collection').evaluate(e=>e.scrollIntoView({block:'start'}));
    if(outputDirectory) await page.screenshot({path:resolve(outputDirectory,'catalog-preview.png')});
    await page.setViewportSize({width:390,height:844});
    await openPanel(); await page.locator('[data-new]').click();
    check('Phone product editor stays within dialog width', await form.evaluate(e=>e.scrollWidth<=e.clientWidth));
    if(outputDirectory) await page.screenshot({path:resolve(outputDirectory,'panel-mobile.png')});
    await close();
    await page.evaluate(() => localStorage.setItem('obekt-studio-v2','{broken'));
    await page.reload();
    check('Corrupt saved JSON recovers seed safely', await count() === 6 && await page.locator('.header [data-cart-count]').textContent() === '0');
    const blocked=await page.context().newPage();
    await blocked.addInitScript(() => { Storage.prototype.getItem=()=>{throw new Error('storage blocked')};Storage.prototype.setItem=()=>{throw new Error('storage blocked')}; });
    await blocked.goto(baseURL);
    await blocked.locator('.product-title [data-product=arc]').click();
    await blocked.locator('[data-add=arc]').click();
    check('Blocked storage keeps current-page cart usable and shows warning', await blocked.locator('#storage-warning').isVisible() && await blocked.locator('.header [data-cart-count]').textContent() === '1');
    await blocked.close();
    check('No browser JavaScript errors', errors.length === 0);
    const report={baseURL,passed:results.length,results,errors};
    if(outputDirectory) await writeFile(resolve(outputDirectory,'ui-check.json'),JSON.stringify(report,null,2)+'\n');
    return report;
  } finally {
    if(other) await other.close();
    page.off('pageerror',onError);page.off('dialog',onDialog);
  }
}

if(process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const browser=await chromium.launch({headless:true});
  try {
    const context=await browser.newContext({acceptDownloads:true});
    const page=await context.newPage();
    const result=await runChecks(page,process.env.DEMO_URL || 'http://127.0.0.1:4183/',process.env.QA_OUTPUT || './qa-output');
    console.log(JSON.stringify(result,null,2));
    if(!process.env.DEMO_URL){const {runServerChecks}=await import('./server-ui.mjs');console.log(JSON.stringify(await runServerChecks(browser,process.env.QA_OUTPUT || './qa-output'),null,2));}
  } finally {await browser.close();}
}
