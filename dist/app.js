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
