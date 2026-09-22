const { chromium } = require('playwright-core');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
let phase = 'antes';
const server = http.createServer(async (req,res) => {
  const base = phase === 'depois' ? 'dist' : 'docs/baseline';
  const file = path.join(root,base, req.url === '/' ? 'index.html' : req.url);
  try {
    let content = await fs.readFile(file);
    if (phase === 'formatador' && req.url === '/script.js') {
      content = content.toString().replace("const STORAGE_KEY", "const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });\nconst STORAGE_KEY").replace("new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format", 'dateFormatter.format');
    }
    const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/manifest+json','.png':'image/png','.webp':'image/webp'};
    res.writeHead(200,{'Content-Type':mime[path.extname(file)] || 'text/plain'}).end(content);
  } catch { res.writeHead(404).end(); }
});
(async () => {
  await new Promise(resolve => server.listen(4176,'127.0.0.1',resolve));
  const browser = await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
  const results = [];
  try {
    for (const count of [0,365]) {
      for (const name of ['antes','formatador','depois']) {
        phase = name;
        const context = await browser.newContext({serviceWorkers:'block',viewport:{width:412,height:823}});
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
        await page.goto('http://127.0.0.1:4176/');
        const measurements = await page.evaluate(async (count) => {
          const entries = Array.from({length:count},(_,i)=>({id:`sample-${i}`,title:`Atividade ${i+1}`,description:'Registro diário de estudo e prática. Revisão dos exercícios, implementação das atividades e verificação dos resultados.',date:new Date(Date.UTC(2025,8,23+i)).toISOString().slice(0,10)}));
          render(entries);
          const samples=[];
          for(let i=0;i<7;i++) {
            await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
            const start = performance.now();
            render(entries);
            const script = performance.now()-start;
            document.body.getBoundingClientRect();
            samples.push({script,total:performance.now()-start});
          }
          return samples;
        },count);
        results.push({phase:name,count,samples:measurements});
        console.log(name,count,JSON.stringify(measurements));
        await context.close();
      }
    }
    await fs.writeFile(path.join(root,'docs/relatorios/benchmark.json'),JSON.stringify(results,null,2));
  } finally { await browser.close(); server.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});

