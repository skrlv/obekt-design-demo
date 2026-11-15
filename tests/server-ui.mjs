import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createApp} from '../server/server.mjs';

export async function runServerChecks(browser, outputDirectory) {
  const temporary=await mkdtemp(join(tmpdir(),'obekt-ui-'));
  const dataFile=join(temporary,'products.json');
  let server, context;
  const results=[];
  const listen=async()=>{
    server=await createApp({dataFile});
    await new Promise(done=>server.listen(0,'127.0.0.1',done));
    return `http://127.0.0.1:${server.address().port}/?backend=1`;
  };
  const stop=()=>new Promise(done=>server.close(done));
  const check=(name,value)=>{assert.ok(value,name);results.push(name);};
  try {
    let url=await listen();
    context=await browser.newContext();
    const page=await context.newPage();
    await page.goto(url);
    await page.locator('.product-card').last().waitFor();
    await page.locator('[data-panel]:visible').first().click();
    check('UI explicitly confirms local server mode and lack of authentication', (await page.locator('#panel-mode').textContent()).includes('Локальный сервер подключён') && (await page.locator('#panel-mode').textContent()).includes('не имеет авторизации'));
    await page.locator('[data-edit=soft]').click();
    const form=page.locator('#product-form');
    await form.locator('[name=price]').fill('32123');
    await form.locator('button[type=submit]').click();
    await form.waitFor({state:'hidden'});
    check('Browser edit writes actual local file', JSON.parse(await readFile(dataFile,'utf8')).find(p=>p.id==='soft').price===32123);
    await stop();
    url=await listen();
    await page.goto(url);
    await page.locator('.product-card').last().waitFor();
    check('Fresh server and browser read persisted price', (await page.locator('.product-title').filter({has:page.locator('[data-product=soft]')}).textContent()).replace(/\D/g,'')==='32123');
    const mutation=await page.request.post(new URL('/api/products',url).href,{headers:{Origin:'https://example.invalid'},data:{}});
    check('Foreign origin cannot mutate catalogue',mutation.status()===403);
    const secret=await page.request.get(new URL('/server/data/products.json',url).href);
    check('Runtime data file cannot be downloaded',secret.status()===404);
    const report={passed:results.length,results,mode:'loopback file catalogue; no account authorization; temporary data removed'};
    if(outputDirectory) await writeFile(resolve(outputDirectory,'server-ui-check.json'),JSON.stringify(report,null,2)+'\n');
    return report;
  } finally {
    if(context) await context.close();
    if(server?.listening) await stop();
    await rm(temporary,{recursive:true,force:true});
  }
}
