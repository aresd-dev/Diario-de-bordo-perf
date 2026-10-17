const test = require('node:test');
const assert = require('node:assert/strict');
const { cacheVersion } = require('./cache-version.cjs');

const base = [
  { name: 'style.css', content: 'body{margin:0}' },
  { name: 'script.js', content: 'console.log(1)' },
];

test('mesmo conteúdo gera o mesmo hash, com 12 caracteres hexadecimais', () => {
  const version = cacheVersion(base);
  assert.equal(version, cacheVersion(base));
  assert.match(version, /^[0-9a-f]{12}$/);
});

test('a ordem dos arquivos não altera o hash', () => {
  assert.equal(cacheVersion(base), cacheVersion([...base].reverse()));
});

test('mudar um byte de um arquivo muda o hash', () => {
  const changed = [{ name: 'style.css', content: 'body{margin:1}' }, base[1]];
  assert.notEqual(cacheVersion(base), cacheVersion(changed));
});

test('renomear um arquivo muda o hash', () => {
  const renamed = [{ name: 'main.css', content: base[0].content }, base[1]];
  assert.notEqual(cacheVersion(base), cacheVersion(renamed));
});

test('mover bytes entre nome e conteúdo não gera colisão', () => {
  const a = [{ name: 'ab', content: 'c' }];
  const b = [{ name: 'a', content: 'bc' }];
  assert.notEqual(cacheVersion(a), cacheVersion(b));
});

test('aceita Buffer como conteúdo (arquivos binários)', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  assert.match(cacheVersion([{ name: 'icon.png', content: png }]), /^[0-9a-f]{12}$/);
});
