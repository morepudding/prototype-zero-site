(() => {
  const labels = { active: 'En cours', local: 'Terminé localement · à publier', interrupted: 'Interrompu · à reprendre', published: 'Publié' };
  let sectorNames = new Map(), loading = false, fullHistory = false, lastHistory = [];
  function renderHistory() {
    const visible = fullHistory ? lastHistory : lastHistory.slice(0, 12);
    document.getElementById('work-history').replaceChildren(...(visible.length ? visible.map(card) : [node('p', 'Les publications liées à un développement apparaîtront ici.', 'sector-empty')]));
    document.getElementById('more-work-history').hidden = fullHistory || lastHistory.length <= 12;
  }
  const node = (tag, value, className) => { const el = document.createElement(tag); el.textContent = value; if (className) el.className = className; return el; };
  function card(work) {
    const el = node('article', '', `sector-card work-card work-${work.status}`);
    el.append(node('p', labels[work.status] || work.status, 'work-status'), node('h4', work.title, 'sector-title'));
    if (work.summary && work.summary !== work.title) el.append(node('p', work.summary, 'sector-description'));
    el.append(node('p', work.sectors.map(id => sectorNames.get(id) || id).join(' · '), 'sector-description'));
    const time = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(work.updatedAt));
    el.append(node('p', `${work.actor === 'akomoses' ? 'Akomoses' : 'morepudding'} · ${time}`, 'work-meta'));
    if (work.status === 'interrupted') el.append(node('p', 'La réservation est libérée. Le travail local peut encore exister.', 'work-meta'));
    if (/^[a-f0-9]{40}$/i.test(work.commit || '')) {
      const link = node('a', `Voir le commit ${work.commit.slice(0, 7)} ↗`, 'work-commit');
      link.href = `https://github.com/aKoMoses/PROTOTYPE-V0.1/commit/${work.commit}`;
      link.target = '_blank'; link.rel = 'noopener noreferrer'; el.append(link);
    }
    return el;
  }
  async function load() {
    if (loading) return;
    loading = true;
    const status = document.getElementById('developments-status');
    try {
      const [response, sectors] = await Promise.all([fetch('/api/developments', { cache: 'no-store', signal: AbortSignal.timeout(10000) }), fetch('/api/sectors', { cache: 'no-store', signal: AbortSignal.timeout(10000) })]);
      if (!response.ok) throw new Error('unavailable');
      if (sectors.ok) sectorNames = new Map((await sectors.json()).sectors.map(s => [s.id, s.title]));
      const { developments } = await response.json();
      for (const actor of ['akomoses', 'morepudding']) {
        const list = document.getElementById(`work-${actor}`);
        const current = developments.filter(work => work.actor === actor && work.status !== 'published');
        list.replaceChildren(...(current.length ? current.map(card) : [node('p', 'Aucun développement déclaré.', 'sector-empty')]));
      }
      lastHistory = developments.filter(work => work.status === 'published');
      renderHistory();
      const active = developments.filter(work => work.status === 'active').length;
      status.textContent = `${active} modification${active > 1 ? 's' : ''} en cours · les responsabilités habituelles sont ci-dessous.`;
    } catch { status.textContent = 'Le tableau des développements est momentanément indisponible. Actualise avant de commencer une modification.'; }
    finally { loading = false; }
  }
  document.getElementById('refresh-developments').addEventListener('click', load);
  document.getElementById('more-work-history').addEventListener('click', () => { fullHistory = true; renderHistory(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  setInterval(() => { if (!document.hidden) load(); }, 30000);
  load();
})();
