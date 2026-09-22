const fs = require('node:fs/promises');
const path = require('node:path');
const { minify: minifyHtml } = require('html-minifier-terser');
const { minify: minifyJs } = require('terser');
const CleanCSS = require('clean-css');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'src');
const output = path.join(root, 'dist');

async function build() {
  await fs.mkdir(path.join(output, 'icons'), { recursive: true });
  const html = await fs.readFile(path.join(source, 'index.html'), 'utf8');
  await fs.writeFile(path.join(output, 'index.html'), await minifyHtml(html, { collapseWhitespace: true, removeComments: true, removeRedundantAttributes: true, removeEmptyAttributes: true, minifyCSS: true, minifyJS: true }));
  const css = new CleanCSS({ level: 2 }).minify(await fs.readFile(path.join(source, 'style.css'), 'utf8'));
  if (css.errors.length) throw new Error(css.errors.join('\n'));
  await fs.writeFile(path.join(output, 'style.css'), css.styles);
  for (const name of ['script.js', 'service-worker.js']) {
    const result = await minifyJs(await fs.readFile(path.join(source, name), 'utf8'), { compress: true, mangle: true, format: { comments: false } });
    await fs.writeFile(path.join(output, name), result.code);
  }
  const manifest = JSON.parse(await fs.readFile(path.join(source, 'manifest.json'), 'utf8'));
  await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest));
  for (const size of [192, 512]) {
    await sharp(path.join(source, 'icons', `icon-${size}.png`)).png({ compressionLevel: 9, palette: true }).toFile(path.join(output, 'icons', `icon-${size}.png`));
  }
  await sharp(path.join(source, 'icons', 'icon-192.png')).resize(84, 84).webp({ lossless: true }).toFile(path.join(output, 'icons', 'brand.webp'));
  console.log('Build concluído em dist/.');
}
build().catch((error) => { console.error(error); process.exitCode = 1; });
