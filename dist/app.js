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
const iconChoiceInputs = [...iconVoteForm.querySelectorAll('input[name="blaster-style"]')];
const requestedStyle = new URL(window.location.href).searchParams.get('style');
let savedStyle = null;
try { savedStyle = window.localStorage.getItem('prototype0-blaster-style'); } catch (_) { /* Storage may be unavailable. */ }
const initialStyle = iconStyleNames[requestedStyle] ? requestedStyle : savedStyle;
const initialInput = iconChoiceInputs.find(input => input.value === initialStyle);
if (initialInput) initialInput.checked = true;

iconVoteForm.addEventListener('change', event => {
  if (event.target.name !== 'blaster-style') return;
  try { window.localStorage.setItem('prototype0-blaster-style', event.target.value); } catch (_) { /* Choice remains visible. */ }
  iconVoteStatus.textContent = `${iconStyleNames[event.target.value]} sélectionné. Valide et partage ton choix pour nous le transmettre.`;
});

iconVoteForm.addEventListener('submit', async event => {
  event.preventDefault();
  const selected = iconVoteForm.querySelector('input[name="blaster-style"]:checked');
  if (!selected) { iconVoteForm.reportValidity(); return; }
  const choice = `${selected.value} — ${iconStyleNames[selected.value]}`;
  const url = new URL(window.location.href);
  url.searchParams.set('style', selected.value);
  url.hash = 'styles-blaster';
  const message = `Je valide le style ${choice} pour les icônes de Prototype 0. ${url.href}`;
  try { window.localStorage.setItem('prototype0-blaster-style', selected.value); } catch (_) { /* Sharing still works. */ }

  if (navigator.share) {
    try {
      await navigator.share({title:'Icône du blaster — Prototype 0', text:`Je valide le style ${choice} pour les icônes de Prototype 0.`, url:url.href});
      iconVoteStatus.textContent = `Style ${choice} partagé. Merci !`;
      return;
    } catch (error) {
      if (error.name === 'AbortError') {
        iconVoteStatus.textContent = 'Partage annulé. Ton choix reste sélectionné sur cet appareil.';
        return;
      }
    }
  }
  try {
    await navigator.clipboard.writeText(message);
    iconVoteStatus.textContent = `Validation copiée : ${choice}. Colle le message dans votre conversation pour nous l’envoyer.`;
  } catch (_) {
    iconVoteStatus.textContent = `Style ${choice} sélectionné. Copie ce lien pour nous l’envoyer : ${url.href}`;
  }
});

const soundVoteForm = document.getElementById('sound-vote-form');
const soundVoteStatus = document.getElementById('sound-vote-status');
const soundNames = {
  impulsion: 'Impulsion',
  plasma: 'Plasma',
  charge: 'Charge'
};
const soundChoiceInputs = [...soundVoteForm.querySelectorAll('input[name="blaster-sound"]')];
const requestedSound = new URL(window.location.href).searchParams.get('son');
let savedSound = null;
try { savedSound = window.localStorage.getItem('prototype0-blaster-sound'); } catch (_) { /* Storage may be unavailable. */ }
const initialSound = soundNames[requestedSound] ? requestedSound : savedSound;
const initialSoundInput = soundChoiceInputs.find(input => input.value === initialSound);
if (initialSoundInput) {
  initialSoundInput.checked = true;
  soundVoteStatus.textContent = `${soundNames[initialSound]} sélectionné.`;
}

soundVoteForm.querySelectorAll('audio').forEach(audio => audio.addEventListener('play', () => {
  soundVoteForm.querySelectorAll('audio').forEach(other => { if (other !== audio) other.pause(); });
}));

soundVoteForm.addEventListener('change', event => {
  if (event.target.name !== 'blaster-sound') return;
  try { window.localStorage.setItem('prototype0-blaster-sound', event.target.value); } catch (_) { /* Choice remains visible. */ }
  soundVoteStatus.textContent = `${soundNames[event.target.value]} sélectionné. Valide et partage ton choix pour nous le transmettre.`;
});

soundVoteForm.addEventListener('submit', async event => {
  event.preventDefault();
  const selected = soundVoteForm.querySelector('input[name="blaster-sound"]:checked');
  if (!selected) { soundVoteForm.reportValidity(); return; }
  const choice = soundNames[selected.value];
  const url = new URL(window.location.href);
  url.searchParams.set('son', selected.value);
  url.hash = 'sons-blaster';
  const message = `Je choisis le son ${choice} pour le Blaster de Prototype 0. ${url.href}`;
  try { window.localStorage.setItem('prototype0-blaster-sound', selected.value); } catch (_) { /* Sharing still works. */ }

  if (navigator.share) {
    try {
      await navigator.share({title:'Son du Blaster — Prototype 0', text:`Je choisis le son ${choice} pour le Blaster de Prototype 0.`, url:url.href});
      soundVoteStatus.textContent = `Son ${choice} partagé. Merci !`;
      return;
    } catch (error) {
      if (error.name === 'AbortError') {
        soundVoteStatus.textContent = 'Partage annulé. Ton choix reste sélectionné sur cet appareil.';
        return;
      }
    }
  }
  try {
    await navigator.clipboard.writeText(message);
    soundVoteStatus.textContent = `Choix copié : ${choice}. Colle le message dans votre conversation pour nous l’envoyer.`;
  } catch (_) {
    soundVoteStatus.textContent = `Son ${choice} sélectionné. Copie ce lien pour nous l’envoyer : ${url.href}`;
  }
});

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
