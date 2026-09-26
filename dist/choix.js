const equipment = [
  {id:'shotgun', name:'SHOTGUN', category:'ARME', description:'Six plombs à courte portée, trois salves avant la recharge.', variants:['Double canon et silhouette ramassée','Barillet massif et canon ventilé']},
  {id:'modulo_drone', name:'MODULO DRONE', category:'OFFENSIF', description:'Projectile guidé qui marque et brûle la cible.', variants:['Drone hexagonal à deux rotors','Drone à ailes triangulaires']},
  {id:'javelin', name:'JAVELIN', category:'OFFENSIF', description:'Javelot lancé, suivi d’une téléportation possible.', variants:['Pointe effilée à filament cyan','Pointe bifide à cœur lumineux']},
  {id:'magnetic_field', name:'MAGNETIC FIELD', category:'DÉFENSIF', description:'Mur magnétique qui absorbe les projectiles.', variants:['Projecteur à deux branches','Disque à champ concentrique']},
  {id:'static_shield', name:'STATIC SHIELD', category:'DÉFENSIF', description:'Stase protectrice pendant un court instant.', variants:['Émetteur hexagonal','Projecteur à rails verticaux']},
  {id:'pyro_boots', name:'PYRO BOOTS', category:'MOBILITÉ', description:'Dash rapide de trois mètres.', variants:['Paire de bottes propulsées','Botte à gros propulseur arrière']},
  {id:'bio_injector', name:'BIO INJECTOR', category:'MOBILITÉ', description:'Accélère déplacement et attaques pendant trois secondes.', variants:['Auto injecteur en forme de stylo','Cartouche compacte à deux fioles']},
  {id:'baroud', name:'BAROUD D’HONNEUR', category:'PASSIF', description:'Une dernière chance après un coup fatal.', variants:['Cœur mécanique fissuré','Plastron cabossé encore actif']},
  {id:'omnivamp', name:'OMNIVAMP', category:'PASSIF', description:'Récupère une part des dégâts infligés.', variants:['Siphon circulaire','Griffe et réservoir d’énergie']}
];
const soundNames = {impulsion:'Impulsion',plasma:'Plasma',charge:'Charge'};
const equipmentList = document.getElementById('equipment-list');
const nameInput = document.getElementById('voter-name');
const resultsStatus = document.getElementById('choice-results-status');
const resultsList = document.getElementById('choice-results-list');
let voterId;
try {
  voterId = localStorage.getItem('prototype0-voter-id') || crypto.randomUUID();
  localStorage.setItem('prototype0-voter-id', voterId);
  nameInput.value = localStorage.getItem('prototype0-voter-name') || '';
} catch (_) {
  voterId = crypto.randomUUID();
}

function savedChoice(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}
nameInput.addEventListener('input', () => {
  try { localStorage.setItem('prototype0-voter-name', nameInput.value); } catch (_) { /* The form remains usable. */ }
});

for (const [index, item] of equipment.entries()) {
  const section = document.createElement('section');
  section.className = 'equipment-choice';
  section.id = item.id;
  section.innerHTML = `
    <div class="equipment-choice-head">
      <div><p class="section-index"><span>${String(index + 1).padStart(2,'0')}</span> / ${item.category}</p><h3>${item.name}</h3></div>
      <p>${item.description}</p>
    </div>
    <form class="equipment-vote" data-item="${item.id}">
      <fieldset class="equipment-vote-grid"><legend class="sr-only">Choisis une icône pour ${item.name}</legend>
        ${['a','b'].map((variant, number) => `
          <label class="icon-option">
            <input type="radio" name="icon-${item.id}" value="${variant}" required>
            <span class="icon-option-art"><img src="./assets/equipment-icons/${item.id.replaceAll('_','-')}-${variant}.png" width="1240" height="1240" loading="lazy" alt="${item.name} : proposition ${variant.toUpperCase()}, ${item.variants[number]}"></span>
            <span class="icon-option-meta"><span class="icon-option-number">${variant.toUpperCase()}</span><strong>PROPOSITION ${variant.toUpperCase()}</strong></span>
            <span class="icon-option-description">${item.variants[number]}</span>
            <span class="icon-option-choose">CHOISIR CETTE ICÔNE <span aria-hidden="true">↗</span></span>
          </label>`).join('')}
      </fieldset>
      <div class="equipment-vote-action"><button class="button button-primary" type="submit">ENREGISTRER CE CHOIX <span aria-hidden="true">↗</span></button><p class="equipment-vote-status" role="status" aria-live="polite"></p></div>
    </form>`;
  equipmentList.append(section);
  const stored = savedChoice(`prototype0-icon-${item.id}`);
  if (stored === 'a' || stored === 'b') section.querySelector(`input[value="${stored}"]`).checked = true;
}

const soundForm = document.getElementById('sound-vote-form');
const storedSound = savedChoice('prototype0-blaster-sound');
if (soundNames[storedSound]) soundForm.querySelector(`input[value="${storedSound}"]`).checked = true;

function requireName() {
  const name = nameInput.value.trim().replace(/\s+/g, ' ');
  nameInput.setCustomValidity(name ? '' : 'Saisis ton prénom pour enregistrer tes choix.');
  if (!nameInput.reportValidity()) {
    nameInput.focus();
    return null;
  }
  return name;
}

async function saveVote(button, status, payload, storageKey) {
  const name = requireName();
  if (!name) return;
  button.disabled = true;
  status.textContent = 'Enregistrement en cours…';
  try {
    const response = await fetch('/api/choices', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({id:voterId,name,...payload})
    });
    if (!response.ok) throw new Error('Save failed');
    const data = await response.json();
    try { localStorage.setItem(storageKey, payload.value); } catch (_) { /* Server save succeeded. */ }
    status.textContent = 'Choix enregistré. Tu peux le changer à tout moment.';
    renderChoices(data.choices);
  } catch (_) {
    status.textContent = 'Enregistrement impossible pour le moment. Réessaie plus tard.';
  } finally {
    button.disabled = false;
  }
}

equipmentList.addEventListener('submit', event => {
  const form = event.target.closest('.equipment-vote');
  if (!form) return;
  event.preventDefault();
  const selected = form.querySelector('input:checked');
  if (!selected || !form.reportValidity()) return;
  saveVote(form.querySelector('button[type="submit"]'), form.querySelector('.equipment-vote-status'), {
    kind:'icon', item:form.dataset.item, value:selected.value
  }, `prototype0-icon-${form.dataset.item}`);
});

soundForm.querySelectorAll('audio').forEach(audio => audio.addEventListener('play', () => {
  soundForm.querySelectorAll('audio').forEach(other => { if (other !== audio) other.pause(); });
}));
soundForm.addEventListener('submit', event => {
  event.preventDefault();
  const selected = soundForm.querySelector('input:checked');
  if (!selected || !soundForm.reportValidity()) return;
  saveVote(soundForm.querySelector('button[type="submit"]'), document.getElementById('sound-vote-status'), {
    kind:'sound', value:selected.value
  }, 'prototype0-blaster-sound');
});

function renderChoices(choices) {
  resultsList.replaceChildren();
  resultsStatus.textContent = choices.length ? `${choices.length} personne${choices.length > 1 ? 's' : ''} ont enregistré des choix.` : 'Aucun choix enregistré pour le moment.';
  for (const item of equipment) {
    const a = choices.filter(choice => choice.icons?.[item.id] === 'a').length;
    const b = choices.filter(choice => choice.icons?.[item.id] === 'b').length;
    const row = document.createElement('div');
    row.className = 'choice-tally';
    const title = document.createElement('strong');
    title.textContent = item.name;
    const counts = document.createElement('span');
    counts.textContent = `A · ${a}     B · ${b}`;
    row.append(title, counts);
    resultsList.append(row);
  }
  const soundRow = document.createElement('div');
  soundRow.className = 'choice-tally';
  const soundTitle = document.createElement('strong');
  soundTitle.textContent = 'SON DU BLASTER';
  const soundCounts = document.createElement('span');
  soundCounts.textContent = Object.entries(soundNames).map(([id, label]) => `${label} · ${choices.filter(choice => choice.sound === id).length}`).join('   ');
  soundRow.append(soundTitle, soundCounts);
  resultsList.append(soundRow);
}
async function refreshChoices() {
  resultsStatus.textContent = 'Chargement des choix…';
  try {
    const response = await fetch('/api/choices', {cache:'no-store'});
    if (!response.ok) throw new Error('Unavailable');
    renderChoices((await response.json()).choices);
  } catch (_) {
    resultsStatus.textContent = 'Les choix enregistrés sont momentanément indisponibles.';
  }
}
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
