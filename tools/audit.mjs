import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { default: lighthouse } = await import(pathToFileURL(require.resolve('lighthouse')).href);
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const phase = process.argv[2];
if (!['antes', 'depois'].includes(phase)) throw new Error('Use npm run audit -- antes ou npm run audit -- depois.');
const root = path.join(project, phase === 'antes' ? 'docs/baseline' : 'dist');
const out = path.join(project, 'docs/relatorios/medicoes');
const chrome = process.env.CHROME_PATH;
if (!chrome) throw new Error('Defina CHROME_PATH com o caminho do executável do Chrome.');
await fs.mkdir(out, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer(async (req,res) => {
  if (req.url === '/seed') { res.writeHead(200, { 'Content-Type':'text/html' }).end('<!doctype html><title>Setup</title>'); return; }
  const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\//, '') || 'index.html');
  try { const content = await fs.readFile(file); res.writeHead(200, { 'Content-Type':types[path.extname(file)] || 'text/plain', 'Cache-Control':'no-cache' }).end(content); }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(4175, '127.0.0.1', resolve));
const results = [];
try {
for (let run = 1; run <= 3; run++) {
  const context = await chromium.launchPersistentContext(path.join(project, '.audit', `${phase}-profile-${Date.now()}`), { executablePath:chrome, headless:true, args:['--remote-debugging-port=9235'], viewport:{width:412,height:823} });
  try {
    const page = context.pages()[0];
    await page.goto('http://127.0.0.1:4175/seed');
    await page.evaluate(() => {
      const entries = Array.from({length:365}, (_,i) => ({ id:`sample-${i}`, title:`Atividade ${i + 1}`, description:'Registro diário de estudo e prática. Revisão dos exercícios, implementação das atividades e verificação dos resultados.', date:new Date(Date.UTC(2025,8,23+i)).toISOString().slice(0,10) }));
      localStorage.setItem('diario-de-bordo-entries',JSON.stringify(entries));
    });
    const result = await lighthouse('http://127.0.0.1:4175/', { port:9235, output:['html','json'], logLevel:'error', onlyCategories:['performance','accessibility','best-practices','seo'], disableStorageReset:true });
    await fs.writeFile(path.join(out, `${phase}-${run}.html`),result.report[0]);
    await fs.writeFile(path.join(out, `${phase}-${run}.json`),result.report[1]);
    const audits = result.lhr.audits;
    const row = {run, scores:Object.fromEntries(Object.entries(result.lhr.categories).map(([k,v])=>[k,v.score*100])), lcp:audits['largest-contentful-paint'].numericValue, fcp:audits['first-contentful-paint'].numericValue, tbt:audits['total-blocking-time'].numericValue, cls:audits['cumulative-layout-shift'].numericValue, bytes:audits['total-byte-weight'].numericValue, requests:audits['network-requests'].details.items.length};
    results.push(row);
    console.log(phase, JSON.stringify(row));
  } finally { await context.close(); }
}
await fs.writeFile(path.join(out,`${phase}-summary.json`),JSON.stringify(results,null,2));
const representative = [...results].sort((a, b) => a.tbt - b.tbt)[1];
await fs.copyFile(path.join(out, `${phase}-${representative.run}.html`), path.join(project, `docs/relatorios/${phase}.html`));
} finally { server.close(); }


