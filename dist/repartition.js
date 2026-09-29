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

const owners = { akomoses: 'Akomoses', morepudding: 'morepudding' };
const status = document.getElementById('board-status');
const unlockDialog = document.getElementById('unlock-dialog');
const sectorDialog = document.getElementById('sector-dialog');
const sectorForm = document.getElementById('sector-form');
const search = document.getElementById('sector-search');
let board = [], editable = false, ready = false, busy = false, editing = null;

function feedback(message, error = false) {
  status.textContent = message;
  status.dataset.error = String(error);
}

function textElement(tag, className, value) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = value;
  return element;
}

function ownerOptions(select, owner) {
  for (const [id, label] of [['', 'À attribuer'], ...Object.entries(owners)]) {
    const option = textElement('option', '', label);
    option.value = id;
    select.append(option);
  }
  select.value = owner || '';
}

function renderCard(sector) {
  const article = document.createElement('article');
  article.className = 'sector-card';
  article.dataset.sector = sector.id;
  const header = document.createElement('div');
  header.className = 'sector-card-header';
  const title = document.createElement('div');
  title.append(textElement('span', 'sector-category', sector.category), textElement('h3', '', sector.title));
  header.append(title);
  if (editable) {
    const edit = textElement('button', 'sector-edit', sector.archived ? 'Restaurer' : 'Modifier');
    edit.type = 'button';
    edit.disabled = busy;
    edit.setAttribute('aria-label', `${sector.archived ? 'Restaurer' : 'Modifier'} ${sector.title}`);
    edit.addEventListener('click', () => sector.archived ? save({ ...sector, archived: false }, 'Secteur restauré.') : openEditor(sector));
    header.append(edit);
  }
  article.append(header);
  if (sector.description) article.append(textElement('p', 'sector-card-description', sector.description));
  if (!sector.archived) {
    const control = document.createElement('div');
    control.className = 'sector-owner-control';
    const label = textElement('label', '', 'Responsable');
    const select = document.createElement('select');
    select.id = `owner-${sector.id}`;
    select.setAttribute('aria-label', `Responsable de ${sector.title}`);
    label.htmlFor = select.id;
    ownerOptions(select, sector.owner);
    select.disabled = !editable || busy;
    select.addEventListener('change', () => save({ ...sector, owner: select.value || null }, select.value ? `Secteur attribué à ${owners[select.value]}.` : 'Secteur remis dans « À attribuer ».'));
    control.append(label, select);
    article.append(control);
  }
  return article;
}

function filtered(sectors) {
  const normalize = value => value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr');
  const query = normalize(search.value.trim());
  return sectors.filter(sector => !query || normalize(`${sector.title} ${sector.description} ${sector.category}`).includes(query));
}

function renderList(id, sectors, emptyText) {
  const list = document.getElementById(id);
  const visible = filtered(sectors);
  list.replaceChildren(...visible.map(renderCard));
  if (!visible.length) list.append(textElement('p', 'sector-empty', sectors.length ? 'Aucun secteur ne correspond à cette recherche.' : emptyText));
}

function render() {
  const active = board.filter(sector => !sector.archived);
  const unassigned = active.filter(sector => !sector.owner);
  const archived = board.filter(sector => sector.archived);
  for (const owner of Object.keys(owners)) {
    const sectors = active.filter(sector => sector.owner === owner);
    document.getElementById(`${owner}-count`).textContent = sectors.length ? `${sectors.length} secteur${sectors.length > 1 ? 's' : ''}` : 'Aucun secteur attribué';
    renderList(`${owner}-list`, sectors, 'Choisis un responsable dans la liste « À attribuer » pour remplir cette colonne.');
  }
  renderList('unassigned-list', unassigned, active.length ? 'Tous les secteurs ont trouvé leur responsable.' : 'Ajoute un secteur pour commencer.');
  renderList('archive-list', archived, 'Aucun secteur archivé.');
  document.getElementById('unassigned-count').textContent = unassigned.length;
  document.getElementById('archive-count').textContent = archived.length;
  document.getElementById('sector-archives').hidden = !archived.length;
  document.getElementById('board-overview').textContent = `${active.length} secteurs · ${active.length - unassigned.length} attribués · ${unassigned.length} à répartir`;
  document.getElementById('unlock-board').hidden = editable;
  document.getElementById('add-sector').hidden = !editable;
  document.getElementById('lock-board').hidden = !editable;
  document.querySelectorAll('.sectors-toolbar button').forEach(button => { button.disabled = !ready || busy; });
}

async function request(body) {
  const response = await fetch('/api/sectors', body ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  } : { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'Enregistrement impossible. Réessaie.');
    error.status = response.status;
    throw error;
  }
  return data;
}

function accept(data) {
  if (!Array.isArray(data.sectors)) throw new Error('Répartition invalide.');
  board = data.sectors;
  editable = data.canEdit === true;
  ready = true;
  const notification = document.getElementById('notification-status');
  if (!data.notification?.configured) notification.textContent = 'Le récapitulatif Discord est en cours de configuration.';
  else if (data.notification.lastReport?.sentAt) {
    const date = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(data.notification.lastReport.sentAt));
    notification.textContent = `Discord chaque matin vers 9 h · dernier envoi le ${date}.`;
  } else notification.textContent = 'Le point sur Discord, chaque matin vers 9 h (heure de Paris).';
}

async function load(manual = false) {
  if (busy) return;
  busy = true;
  if (ready) render();
  document.getElementById('unlock-board').disabled = true;
  document.getElementById('refresh-board').disabled = true;
  try {
    accept(await request());
    if (manual) feedback('Répartition actualisée.');
  } catch (error) {
    feedback(error.message, true);
    if (!ready) {
      document.getElementById('board-overview').textContent = 'La répartition n’a pas pu être chargée.';
      ['akomoses-list', 'morepudding-list'].forEach(id => {
        document.getElementById(id).replaceChildren(textElement('p', 'sector-empty', 'Réessaie avec le bouton « Actualiser ».'));
      });
    }
  } finally {
    busy = false;
    if (ready) render();
    document.getElementById('refresh-board').disabled = false;
  }
}

async function save(sector, message = 'Secteur enregistré.') {
  if (busy) return false;
  busy = true;
  render();
  try {
    accept(await request({ ...sector, action: sector.id ? 'update' : 'create' }));
    feedback(message);
    return true;
  } catch (error) {
    if (error.status === 401) editable = false;
    if (error.status === 409) {
      try { accept(await request()); } catch (_) { /* Keep the current board if refresh also fails. */ }
      if (editing && sectorDialog.open) {
        document.getElementById('sector-feedback').textContent = `${error.message} Ferme puis rouvre cette fiche pour repartir de la dernière version.`;
        feedback(error.message, true);
        return false;
      }
    }
    feedback(error.message, true);
    document.getElementById('sector-feedback').textContent = error.message;
    return false;
  } finally { busy = false; render(); }
}

function openEditor(sector = null) {
  editing = sector;
  sectorForm.reset();
  document.getElementById('sector-dialog-title').textContent = sector ? 'Modifier le secteur' : 'Ajouter un secteur';
  document.getElementById('sector-title').value = sector?.title || '';
  document.getElementById('sector-description').value = sector?.description || '';
  document.getElementById('sector-category').value = sector?.category || 'Autre';
  document.getElementById('sector-owner').value = sector?.owner || '';
  document.getElementById('archive-sector').hidden = !sector;
  document.getElementById('sector-feedback').textContent = '';
  sectorDialog.showModal();
}

document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.getElementById('unlock-board').addEventListener('click', () => {
  document.getElementById('unlock-form').reset();
  document.getElementById('unlock-feedback').textContent = '';
  unlockDialog.showModal();
});
document.getElementById('unlock-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    await request({ action: 'unlock', code: document.getElementById('edit-code').value });
    document.getElementById('edit-code').value = '';
    unlockDialog.close();
    await load();
    feedback('Tu peux maintenant attribuer, modifier et ajouter des secteurs.');
  } catch (error) { document.getElementById('unlock-feedback').textContent = error.message; }
  finally { button.disabled = false; }
});
document.getElementById('lock-board').addEventListener('click', async () => {
  try { await request({ action: 'lock' }); editable = false; render(); feedback('Édition verrouillée.'); }
  catch (error) { feedback(error.message, true); }
});
document.getElementById('add-sector').addEventListener('click', () => openEditor());
document.getElementById('refresh-board').addEventListener('click', () => load(true));
search.addEventListener('input', () => { if (ready) render(); });
sectorForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  const sector = {
    ...(editing || {}), title: document.getElementById('sector-title').value,
    description: document.getElementById('sector-description').value,
    category: document.getElementById('sector-category').value, owner: document.getElementById('sector-owner').value || null
  };
  if (await save(sector)) sectorDialog.close();
  button.disabled = false;
});
document.getElementById('archive-sector').addEventListener('click', async () => {
  if (editing && await save({ ...editing, archived: true }, 'Secteur archivé. Tu peux le restaurer en bas de la page.')) sectorDialog.close();
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && !sectorDialog.open && !unlockDialog.open) load(); });
load();
