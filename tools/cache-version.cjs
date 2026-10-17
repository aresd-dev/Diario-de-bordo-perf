const crypto = require('node:crypto');

// Hash curto e determinístico do conteúdo dos arquivos que o service worker guarda em cache.
// A ordem de entrada não importa; nome e tamanho entram no hash para evitar colisões por concatenação.
function cacheVersion(files) {
  const hash = crypto.createHash('sha256');
  const ordered = [...files].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const { name, content } of ordered) {
    const bytes = Buffer.from(content);
    hash.update(`${name}\0${bytes.length}\0`);
    hash.update(bytes);
  }
  return hash.digest('hex').slice(0, 12);
}

module.exports = { cacheVersion };
