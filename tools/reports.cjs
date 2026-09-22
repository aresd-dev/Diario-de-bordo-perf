const { chromium } = require('playwright-core');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root=path.resolve(__dirname, '..');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1365,height:1200},deviceScaleFactor:1});
    for(const phase of ['antes','depois']){
      await page.goto(pathToFileURL(path.join(root,`docs/relatorios/${phase}.html`)).href);
      await page.waitForSelector('.lh-metrics-container');
      await page.screenshot({path:path.join(root,`docs/relatorios/${phase}.png`)});
    }
    const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
    const comparison={};
    for(const phase of ['antes','depois']){
      const samples=JSON.parse(await fs.readFile(path.join(root, `docs/relatorios/medicoes/${phase}-summary.json`),'utf8'));
      comparison[phase]=Object.fromEntries(['lcp','fcp','tbt','cls','bytes','requests'].map(key=>[key,median(samples.map(row=>row[key]))]));
      comparison[phase].scores=Object.fromEntries(Object.keys(samples[0].scores).map(key=>[key,median(samples.map(row=>row.scores[key]))]));
    }
    const benchmark=JSON.parse(await fs.readFile(path.join(root,'docs/relatorios/benchmark.json'),'utf8'));
    comparison.benchmark=benchmark.map(row=>({phase:row.phase,count:row.count,script:median(row.samples.map(s=>s.script)),total:median(row.samples.map(s=>s.total))}));
    comparison.files=[];
    for(const file of ['index.html','style.css','script.js','service-worker.js','manifest.json','icons/icon-192.png','icons/icon-512.png']){
      comparison.files.push({file,antes:(await fs.stat(path.join(root,'docs/baseline',file))).size,depois:(await fs.stat(path.join(root,'dist',file))).size});
    }
    comparison.files.push({file:'icons/brand.webp',antes:0,depois:(await fs.stat(path.join(root,'dist/icons/brand.webp'))).size});
    await fs.writeFile(path.join(root,'docs/relatorios/comparativo.json'),JSON.stringify(comparison,null,2));
    console.log(JSON.stringify(comparison,null,2));
  } finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

