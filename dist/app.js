const loadouts = {
  arme: {index:'01',caption:'FRAPPE À DISTANCE',name:'BLASTER <span>OU</span> SHOTGUN',description:'Précision et tir chargé d’un côté. Six plombs à courte portée de l’autre. Le choix de l’arme change le rythme de chaque échange.',tags:['TIR CHARGÉ','COURTE PORTÉE','CHOIX DE BUILD']},
  offensif: {index:'02',caption:'PRENDS L’INITIATIVE',name:'DRONE <span>OU</span> JAVELIN',description:'Envoie un projectile guidé qui marque et brûle ta cible, ou lance un javelot puis tente une téléportation pour renverser le duel.',tags:['DÉGÂTS','MARQUAGE','REPOSITIONNEMENT']},
  defensif: {index:'03',caption:'TIENS LA LIGNE',name:'CHAMP <span>OU</span> STASE',description:'Dresse un mur magnétique contre les projectiles ou active un bouclier statique pour devenir momentanément invulnérable.',tags:['PROTECTION','ABSORPTION','SURVIE']},
  mobilite: {index:'04',caption:'RESTE INSAISISSABLE',name:'PYRO BOOTS <span>OU</span> BIO INJECTOR',description:'Traverse le terrain d’un dash rapide ou accélère tes déplacements, tes attaques et tes temps de récupération.',tags:['DASH','VITESSE','TEMPO']},
  passif: {index:'05',caption:'LE DERNIER MOT',name:'BAROUD <span>OU</span> OMNIVAMP',description:'Survis brièvement à un coup fatal grâce au Baroud d’honneur, ou récupère une part des dégâts infligés avec Omnivamp.',tags:['SURVIE','RÉCUPÉRATION','PASSIF EXCLUSIF']}
};

const tabs = [...document.querySelectorAll('.loadout-tab')];
const detail = document.querySelector('.loadout-detail');
tabs.forEach(tab => tab.addEventListener('click', () => {
  const data = loadouts[tab.dataset.loadout];
  tabs.forEach(item => { item.classList.toggle('active', item === tab); item.setAttribute('aria-pressed', String(item === tab)); });
  detail.classList.remove('flash');
  void detail.offsetWidth;
  detail.classList.add('flash');
  document.getElementById('loadout-index').textContent = data.index;
  document.getElementById('loadout-caption').textContent = data.caption;
  document.getElementById('loadout-name').innerHTML = data.name;
  document.getElementById('loadout-description').textContent = data.description;
  document.getElementById('loadout-tags').innerHTML = data.tags.map(tag => `<span>${tag}</span>`).join('');
  document.querySelector('.loadout-watermark').textContent = data.index;
}));

const iconVoteForm = document.getElementById('icon-vote-form');
const iconVoteStatus = document.getElementById('icon-vote-status');
const iconStyleNames = {
  '01': 'Aplat graphique',
  '02': 'Hologramme',
  '03': 'Low poly',
  '04': 'Gravure',
  '05': 'Pixel art'
};
const soundVoteForm = document.getElementById('sound-vote-form');
const soundVoteStatus = document.getElementById('sound-vote-status');
const soundNames = {
  impulsion: 'Impulsion',
  plasma: 'Plasma',
  charge: 'Charge'
};
const resultsStatus = document.getElementById('choice-results-status');
const resultsList = document.getElementById('choice-results-list');
const nameInputs = [...document.querySelectorAll('.vote-name-input')];
let voterId = null;
let voterName = '';
try {
  voterId = window.localStorage.getItem('prototype0-voter-id');
  if (!voterId) {
    voterId = crypto.randomUUID();
    window.localStorage.setItem('prototype0-voter-id', voterId);
  }
  voterName = window.localStorage.getItem('prototype0-voter-name') || '';
} catch (_) {
  voterId = crypto.randomUUID();
}
nameInputs.forEach(input => {
  input.value = voterName;
  input.addEventListener('input', () => {
    voterName = input.value;
    nameInputs.forEach(other => { if (other !== input) other.value = voterName; });
    try { window.localStorage.setItem('prototype0-voter-name', voterName); } catch (_) { /* Storage may be unavailable. */ }
  });
});

function restoreChoice(form, fieldName, queryName, storageName, validNames) {
  const requested = new URL(window.location.href).searchParams.get(queryName);
  let saved = null;
  try { saved = window.localStorage.getItem(storageName); } catch (_) { /* Storage may be unavailable. */ }
  const value = validNames[requested] ? requested : saved;
  const input = [...form.querySelectorAll(`input[name="${fieldName}"]`)].find(item => item.value === value);
  if (input) input.checked = true;
}
restoreChoice(iconVoteForm, 'blaster-style', 'style', 'prototype0-blaster-style', iconStyleNames);
restoreChoice(soundVoteForm, 'blaster-sound', 'son', 'prototype0-blaster-sound', soundNames);

function renderChoices(choices) {
  resultsList.replaceChildren();
  resultsStatus.textContent = choices.length ? `${choices.length} choix enregistré${choices.length > 1 ? 's' : ''}.` : 'Aucun choix enregistré pour le moment.';
  choices.forEach(choice => {
    const row = document.createElement('div');
    row.className = 'choice-result';
    const name = document.createElement('strong');
    name.textContent = choice.name;
    row.append(name);
    for (const [label, value] of [
      ['ICÔNE', iconStyleNames[choice.style] || 'À choisir'],
      ['SON', soundNames[choice.sound] || 'À choisir']
    ]) {
      const cell = document.createElement('span');
      const title = document.createElement('b');
      title.textContent = label;
      cell.append(title, document.createTextNode(value));
      row.append(cell);
    }
    resultsList.append(row);
  });
}

async function refreshChoices() {
  resultsStatus.textContent = 'Chargement des choix…';
  try {
    const response = await fetch('/api/choices', { cache: 'no-store' });
    if (!response.ok) throw new Error('Database unavailable');
    const data = await response.json();
    renderChoices(data.choices);
  } catch (_) {
    resultsStatus.textContent = 'Les choix enregistrés sont momentanément indisponibles.';
  }
}

async function saveChoice(form, kind, fieldName, storageName, names, status) {
  const selected = form.querySelector(`input[name="${fieldName}"]:checked`);
  const nameInput = form.querySelector('.vote-name-input');
  const name = nameInput.value.trim();
  nameInput.setCustomValidity(name ? '' : 'Saisis un prénom.');
  if (!selected || !form.reportValidity()) return;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  status.textContent = 'Enregistrement en cours…';
  try {
    const response = await fetch('/api/choices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: voterId, name, kind, value: selected.value })
    });
    if (!response.ok) throw new Error('Save failed');
    const data = await response.json();
    try { window.localStorage.setItem(storageName, selected.value); } catch (_) { /* Server save succeeded. */ }
    status.textContent = `${names[selected.value]} enregistré pour ${name}. Ton choix apparaît ci-dessous.`;
    renderChoices(data.choices);
  } catch (_) {
    status.textContent = 'Enregistrement impossible pour le moment. Réessaie plus tard.';
  } finally {
    button.disabled = false;
  }
}

iconVoteForm.addEventListener('change', event => {
  if (event.target.name === 'blaster-style') iconVoteStatus.textContent = `${iconStyleNames[event.target.value]} sélectionné. Enregistre ton choix pour le sauvegarder.`;
});
iconVoteForm.addEventListener('submit', event => {
  event.preventDefault();
  saveChoice(iconVoteForm, 'style', 'blaster-style', 'prototype0-blaster-style', iconStyleNames, iconVoteStatus);
});

soundVoteForm.querySelectorAll('audio').forEach(audio => audio.addEventListener('play', () => {
  soundVoteForm.querySelectorAll('audio').forEach(other => { if (other !== audio) other.pause(); });
}));
soundVoteForm.addEventListener('change', event => {
  if (event.target.name === 'blaster-sound') soundVoteStatus.textContent = `${soundNames[event.target.value]} sélectionné. Enregistre ton choix pour le sauvegarder.`;
});
soundVoteForm.addEventListener('submit', event => {
  event.preventDefault();
  saveChoice(soundVoteForm, 'sound', 'blaster-sound', 'prototype0-blaster-sound', soundNames, soundVoteStatus);
});
document.getElementById('refresh-choices').addEventListener('click', refreshChoices);
refreshChoices();

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

const header = document.querySelector('.site-header');
const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 20);
updateHeader();
window.addEventListener('scroll', updateHeader, {passive:true});

if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
  }), {threshold:0.08, rootMargin:'0px 0px 40px 0px'});
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
} else {
  document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
}
