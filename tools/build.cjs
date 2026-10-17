const fs = require('node:fs/promises');
const path = require('node:path');
const { minify: minifyHtml } = require('html-minifier-terser');
const { minify: minifyJs } = require('terser');
const CleanCSS = require('clean-css');
const sharp = require('sharp');
const { cacheVersion } = require('./cache-version.cjs');
const root = path.resolve(__dirname, '..');
const PLACEHOLDER = '__CACHE_VERSION__';
// Arquivos que o service worker guarda em cache; o hash deles dá o nome do cache.
const CACHED_FILES = ['index.html', 'style.css', 'script.js', 'manifest.json', 'icons/brand.webp', 'icons/icon-192.png', 'icons/icon-512.png'];

async function build(source = path.join(root, 'src'), output = path.join(root, 'dist')) {
  await fs.mkdir(path.join(output, 'icons'), { recursive: true });
  const html = await fs.readFile(path.join(source, 'index.html'), 'utf8');
  await fs.writeFile(path.join(output, 'index.html'), await minifyHtml(html, { collapseWhitespace: true, removeComments: true, removeRedundantAttributes: true, removeEmptyAttributes: true, minifyCSS: true, minifyJS: true }));
  const css = new CleanCSS({ level: 2 }).minify(await fs.readFile(path.join(source, 'style.css'), 'utf8'));
  if (css.errors.length) throw new Error(css.errors.join('\n'));
  await fs.writeFile(path.join(output, 'style.css'), css.styles);
  const script = await minifyJs(await fs.readFile(path.join(source, 'script.js'), 'utf8'), { compress: true, mangle: true, format: { comments: false } });
  await fs.writeFile(path.join(output, 'script.js'), script.code);
  const manifest = JSON.parse(await fs.readFile(path.join(source, 'manifest.json'), 'utf8'));
  await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest));
  for (const size of [192, 512]) {
    await sharp(path.join(source, 'icons', `icon-${size}.png`)).png({ compressionLevel: 9, palette: true }).toFile(path.join(output, 'icons', `icon-${size}.png`));
  }
  await sharp(path.join(source, 'icons', 'icon-192.png')).resize(84, 84).webp({ lossless: true }).toFile(path.join(output, 'icons', 'brand.webp'));

  // O service worker é o último: o nome do cache depende do conteúdo final dos demais arquivos.
  const cached = await Promise.all(CACHED_FILES.map(async (name) => ({ name, content: await fs.readFile(path.join(output, name)) })));
  const worker = await fs.readFile(path.join(source, 'service-worker.js'), 'utf8');
  if (!worker.includes(PLACEHOLDER)) throw new Error(`service-worker.js precisa conter ${PLACEHOLDER} no nome do cache.`);
  const versioned = worker.replaceAll(PLACEHOLDER, cacheVersion(cached));
  const result = await minifyJs(versioned, { compress: true, mangle: true, format: { comments: false } });
  await fs.writeFile(path.join(output, 'service-worker.js'), result.code);
  console.log('Build concluído em dist/.');
}

if (require.main === module) build().catch((error) => { console.error(error); process.exitCode = 1; });

module.exports = { build };
