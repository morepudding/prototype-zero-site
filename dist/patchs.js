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

function addText(parent, tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value;
  parent.append(element);
  return element;
}

function renderPush(push, index) {
  const article = document.createElement('article');
  article.className = 'patch-card';
  const visual = document.createElement('div');
  visual.className = `patch-card-visual${push.imageStyle === 'icon' ? ' patch-card-visual-icon' : ''}`;
  const image = document.createElement('img');
  image.src = push.image;
  image.alt = push.imageAlt;
  image.loading = 'eager';
  image.width = 1280;
  image.height = 720;
  visual.append(image);
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
  addText(body, 'p', 'patch-pending', 'À RÉCUPÉRER');
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
  if (push.source) {
    const source = addText(body, 'a', 'patch-source', 'VOIR CE COMMIT SUR GITHUB ↗');
    source.href = push.source;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
  }
  article.append(visual, body);
  return article;
}

fetch('./data/patchs.json')
  .then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then(data => {
    if (!Array.isArray(data.pushes)) throw new Error('Document invalide');
    const pending = data.pushes.filter(push => push.status === 'a_recuperer');
    pending.forEach((push, index) => list.append(renderPush(push, index)));
    status.textContent = pending.length ? '' : 'Aucun push en attente de récupération.';
    status.hidden = pending.length > 0;
  })
  .catch(() => {
    status.textContent = 'Impossible de charger les pushes pour le moment. Réessaie plus tard.';
  });
