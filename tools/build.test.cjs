const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { build } = require('./build.cjs');

const realSource = path.resolve(__dirname, '../src');

async function workspace() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'diario-build-'));
  const source = path.join(dir, 'src');
  await fs.cp(realSource, source, { recursive: true });
  return { dir, source, output: path.join(dir, 'dist') };
}

const cacheName = async (output) => {
  const sw = await fs.readFile(path.join(output, 'service-worker.js'), 'utf8');
  return sw;
};

test('dois builds sem mudanças geram service-worker.js idêntico', async () => {
  const { dir, source, output } = await workspace();
  try {
    await build(source, output);
    const first = await cacheName(output);
    await build(source, output);
    assert.equal(await cacheName(output), first);
    assert.ok(!first.includes('__CACHE_VERSION__'), 'o placeholder precisa ser substituído');
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('mudar um byte do CSS muda o service-worker.js gerado', async () => {
  const { dir, source, output } = await workspace();
  try {
    await build(source, output);
    const before = await cacheName(output);
    const css = path.join(source, 'style.css');
    await fs.writeFile(css, `${await fs.readFile(css, 'utf8')}\n/* mudança */ body { margin: 1px; }\n`);
    await build(source, output);
    assert.notEqual(await cacheName(output), before);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('o build falha se o service worker não tiver o placeholder', async () => {
  const { dir, source, output } = await workspace();
  try {
    const sw = path.join(source, 'service-worker.js');
    await fs.writeFile(sw, (await fs.readFile(sw, 'utf8')).replace('__CACHE_VERSION__', 'performance-v1'));
    await assert.rejects(() => build(source, output), /__CACHE_VERSION__/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
