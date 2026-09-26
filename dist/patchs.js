const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');
menuToggle.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') !== 'true';
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
  nav.classList.toggle('open', open);
});
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Ouvrir le menu');
  nav.classList.remove('open');
}));

const list = document.getElementById('patchs-list');
const status = document.getElementById('patchs-status');
const readerSelect = document.getElementById('pull-reader');
const readers = ['BotteroRomain', 'aKoMoses'];
let pullRecords = null;
let pushList = [];

try {
  const savedReader = localStorage.getItem('prototype0-pull-reader');
  if (readers.includes(savedReader)) readerSelect.value = savedReader;
} catch (_) {
  // Le choix du nom reste utilisable si le stockage local est désactivé.
}

readerSelect.addEventListener('change', () => {
  try {
    localStorage.setItem('prototype0-pull-reader', readerSelect.value);
  } catch (_) {
    // La confirmation côté serveur reste disponible.
  }
  updatePullPanels();
});

function addText(parent, tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value;
  parent.append(element);
  return element;
}

function dateLabel(iso) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris'
  }).format(new Date(iso));
}

function updatePullPanels() {
  pushList.forEach(push => {
    const reader = readers.find(name => name !== push.author);
    const panel = document.getElementById(`pull-${push.commit}`);
    if (!panel || !reader) return;
    const message = panel.querySelector('.pull-message');
    const button = panel.querySelector('button');
    const record = pullRecords?.find(item => item.commit === push.commit && item.reader === reader);
    if (pullRecords === null) {
      message.textContent = `Statut de ${reader} temporairement indisponible.`;
      button.hidden = true;
    } else if (record?.pulledAt) {
      message.textContent = `${reader} a confirmé son pull le ${dateLabel(record.pulledAt)} (heure de Paris).`;
      button.hidden = true;
      panel.classList.add('pull-confirmed');
    } else {
      message.textContent = `${reader} n’a pas encore confirmé avoir récupéré ce push.`;
      button.hidden = readerSelect.value !== reader;
      panel.classList.remove('pull-confirmed');
    }
  });
}

async function confirmPull(push, reader, button) {
  button.disabled = true;
  button.textContent = 'ENREGISTREMENT…';
  try {
    const response = await fetch('/api/pulls', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({commit: push.commit, reader})
    });
    const data = await response.json();
    if (!response.ok || !data.record?.pulledAt) throw new Error(data.error || 'Échec de la confirmation.');
    pullRecords = pullRecords.filter(item => !(item.commit === push.commit && item.reader === reader));
    pullRecords.push(data.record);
    document.getElementById(`pull-${push.commit}`).querySelector('.pull-feedback').textContent = '';
    updatePullPanels();
  } catch (_) {
    const panel = document.getElementById(`pull-${push.commit}`);
    panel.querySelector('.pull-feedback').textContent = 'Impossible d’enregistrer la confirmation. Réessaie.';
  } finally {
    button.disabled = false;
    button.textContent = 'J’AI FAIT GIT PULL';
  }
}

function renderPush(push, index) {
  const article = document.createElement('article');
  article.className = 'patch-card';
  article.id = `push-${push.commit}`;
  const visual = document.createElement('div');
  visual.className = `patch-card-visual${push.imageStyle === 'icon' ? ' patch-card-visual-icon' : ''}${push.image ? '' : ' patch-card-visual-auto'}`;
  if (push.image) {
    const image = document.createElement('img');
    image.src = push.image;
    image.alt = push.imageAlt;
    image.loading = 'eager';
    image.width = 1280;
    image.height = 720;
    visual.append(image);
  } else {
    addText(visual, 'strong', 'patch-card-visual-title', push.title);
  }
  addText(visual, 'span', 'patch-card-visual-label', `PUSH ${String(index + 1).padStart(2, '0')} / ${push.commit.slice(0, 7)}`);

  const body = document.createElement('div');
  body.className = 'patch-card-body';
  const meta = document.createElement('div');
  meta.className = 'patch-card-meta';
  addText(meta, 'span', 'patch-version', push.commit.slice(0, 7));
  if (push.date) {
    const date = addText(meta, 'time', '', new Intl.DateTimeFormat('fr-FR', {dateStyle: 'long', timeZone: 'UTC'}).format(new Date(`${push.date}T00:00:00Z`)));
    date.dateTime = push.date;
  }
  addText(meta, 'span', 'patch-author', `PAR ${push.author}`);
  body.append(meta);
  addText(body, 'h3', '', push.title);
  addText(body, 'p', 'patch-summary', push.summary);
  addText(body, 'h4', '', 'CE QUE CE PUSH CONTIENT');
  const changes = document.createElement('ul');
  changes.className = 'patch-changes';
  push.changes.forEach(change => addText(changes, 'li', '', change));
  body.append(changes);
  if (push.audio) {
    const sound = document.createElement('div');
    sound.className = 'patch-sound';
    addText(sound, 'strong', '', 'ÉCOUTER LE SON PLASMA');
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.preload = 'none';
    audio.src = push.audio;
    audio.setAttribute('aria-label', 'Écouter le son Plasma du Blaster');
    sound.append(audio);
    body.append(sound);
  }
  if (push.toTry) {
    const next = document.createElement('p');
    next.className = 'patch-next';
    addText(next, 'strong', '', 'À TESTER / ');
    next.append(document.createTextNode(push.toTry));
    body.append(next);
  }
  const otherReader = readers.find(name => name !== push.author);
  if (otherReader) {
    const panel = document.createElement('div');
    panel.className = 'pull-panel';
    panel.id = `pull-${push.commit}`;
    addText(panel, 'strong', '', 'SUIVI DU PULL');
    addText(panel, 'p', 'pull-message', 'Chargement du statut…');
    const button = addText(panel, 'button', 'pull-button', 'J’AI FAIT GIT PULL');
    button.type = 'button';
    button.hidden = true;
    button.addEventListener('click', () => confirmPull(push, otherReader, button));
    addText(panel, 'p', 'pull-feedback', '');
    body.append(panel);
  }
  if (push.source) {
    const source = addText(body, 'a', 'patch-source', 'VOIR CE COMMIT SUR GITHUB ↗');
    source.href = push.source;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
  }
  article.append(visual, body);
  return article;
}

async function loadPushes() {
  try {
    let response = await fetch('/api/game-pushes', {cache: 'no-store'});
    if (!response.ok) response = await fetch('./data/patchs.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.pushes)) throw new Error('Document invalide');
    pushList = data.pushes;
    pushList.forEach((push, index) => list.append(renderPush(push, index)));
    if (location.hash.startsWith('#push-')) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    status.textContent = pushList.length ? '' : 'Aucun push publié pour le moment.';
    status.hidden = pushList.length > 0;
  } catch (_) {
    status.textContent = 'Impossible de charger les pushes pour le moment. Réessaie plus tard.';
    return;
  }

  try {
    const response = await fetch('/api/pulls', {cache: 'no-store'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.records)) throw new Error('Réponse invalide');
    pullRecords = data.records;
  } catch (_) {
    pullRecords = null;
  }
  updatePullPanels();
}

loadPushes();
