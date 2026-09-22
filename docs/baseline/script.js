const STORAGE_KEY = 'diario-de-bordo-entries';
const form = document.querySelector('#entry-form');
const titleInput = document.querySelector('#title');
const dateInput = document.querySelector('#date');
const descriptionInput = document.querySelector('#description');
const list = document.querySelector('#entries');
const feedback = document.querySelector('#feedback');
const installButton = document.querySelector('#install-button');
let installPrompt = null;
let offlineReady = false;

function notify(message, error = false) {
  feedback.textContent = message;
  feedback.classList.toggle('error', error);
}

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function createId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function readEntries() {
  const entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  if (!Array.isArray(entries) || entries.some((entry) => !entry || typeof entry.id !== 'string' ||
    typeof entry.title !== 'string' || typeof entry.description !== 'string' || !validDate(entry.date))) {
    throw new Error('Invalid entries');
  }
  return entries;
}

function render(entries) {
  list.replaceChildren();
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  for (const entry of sorted) {
    const item = document.createElement('li');
    item.className = 'entry';
    const top = document.createElement('div');
    top.className = 'entry-top';
    const time = document.createElement('time');
    time.dateTime = entry.date;
    time.textContent = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(`${entry.date}T12:00:00`));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove';
    remove.textContent = 'Remover';
    remove.setAttribute('aria-label', `Remover entrada: ${entry.title}`);
    remove.addEventListener('click', () => removeEntry(entry));
    const title = document.createElement('h3');
    title.textContent = entry.title;
    const description = document.createElement('p');
    description.textContent = entry.description;
    top.append(time, remove);
    item.append(top, title, description);
    list.append(item);
  }
  document.querySelector('#empty-state').hidden = entries.length > 0;
  document.querySelector('#entry-count').textContent = `${entries.length} ${entries.length === 1 ? 'entrada' : 'entradas'}`;
}

function refresh() {
  try {
    render(readEntries());
  } catch {
    notify('Não foi possível ler os registros. Verifique se o armazenamento do navegador está disponível. Os dados existentes foram preservados.', true);
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  render(entries);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const description = descriptionInput.value.trim();
  if (!title || !description || !validDate(dateInput.value)) {
    notify('Preencha o título, a descrição e uma data válida.', true);
    (!title ? titleInput : !description ? descriptionInput : dateInput).focus();
    return;
  }
  try {
    const entries = readEntries();
    entries.unshift({ id: createId(), title, description, date: dateInput.value });
    saveEntries(entries);
    form.reset();
    dateInput.value = today();
    notify('Entrada salva.');
    titleInput.focus();
  } catch {
    notify('Não foi possível salvar. Verifique o espaço e a permissão de armazenamento do navegador. Seu texto continua no formulário.', true);
  }
});

function removeEntry(entry) {
  if (!window.confirm(`Remover a entrada “${entry.title}”?`)) return;
  try {
    saveEntries(readEntries().filter((item) => item.id !== entry.id));
    notify('Entrada removida.');
    titleInput.focus();
  } catch {
    notify('Não foi possível remover a entrada. Tente novamente.', true);
  }
}

function updateConnection() {
  const status = document.querySelector('#connection-status');
  if (!window.isSecureContext) {
    status.textContent = 'Modo offline e instalação exigem HTTPS ou localhost.';
    return;
  }
  status.textContent = offlineReady
    ? navigator.onLine ? 'Pronto para usar offline' : 'Sem conexão · continue registrando seu dia'
    : navigator.onLine ? 'Conectado · preparando modo offline' : 'Sem conexão · modo offline ainda não disponível';
}

window.addEventListener('online', updateConnection);
window.addEventListener('offline', updateConnection);
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === null) refresh();
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  if (!window.isSecureContext) return;
  installPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener('click', async () => {
  if (!installPrompt) return;
  const prompt = installPrompt;
  installPrompt = null;
  installButton.hidden = true;
  try {
    await prompt.prompt();
    await prompt.userChoice;
  } catch {
    notify('Use a opção de instalação no menu do navegador.');
  }
});

window.addEventListener('appinstalled', () => {
  installPrompt = null;
  installButton.hidden = true;
  notify('Aplicativo instalado.');
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').then(() => navigator.serviceWorker.ready).then(() => {
    offlineReady = true;
    updateConnection();
  }).catch(() => notify('O modo offline não ficou disponível. Conecte-se e recarregue a página para tentar novamente.', true));
}

dateInput.value = today();
updateConnection();
refresh();
