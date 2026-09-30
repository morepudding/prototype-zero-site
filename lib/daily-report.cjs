const { shortSummary } = require('./work-summary.cjs');
const PAGE_URL = 'https://prototype-zero-site.vercel.app/repartition.html#developpements';
function parisDay(now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
function previousDay(now) {
  const day = new Date(`${parisDay(now)}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}
function timestampDay(value) {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? parisDay(date) : null;
}
function workOfDay(developments, day) {
  const seen = new Set();
  return developments.filter(work => {
    if (!['local', 'published'].includes(work.status) || !['akomoses', 'morepudding'].includes(work.actor) || seen.has(work.id)) return false;
    const completed = timestampDay(work.completedAt || (work.status === 'local' ? work.updatedAt : null));
    const published = timestampDay(work.publishedAt || (work.status === 'published' ? work.updatedAt : null));
    if (completed !== day && published !== day) return false;
    seen.add(work.id); return true;
  });
}
function summarize(sectors, now = new Date(), developments = []) {
  const yesterday = previousDay(now);
  const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' }).format(new Date(`${yesterday}T12:00:00Z`));
  const relevant = workOfDay(developments, yesterday);
  const names = new Map(sectors.map(sector => [sector.id, shortSummary(sector.title, 64)]));
  // A cross-sector modification appears once, with every associated sector in its heading.
  const groups = new Map();
  for (const work of relevant) {
    const heading = [...new Set(work.sectors)].sort().map(id => names.get(id) || shortSummary(id, 64)).join(' · ');
    if (!groups.has(heading)) groups.set(heading, []);
    groups.get(heading).push(work);
  }
  const active = sectors.filter(sector => !sector.archived);
  const shared = active.filter(sector => sector.owner === 'both').length;
  const akomoses = active.filter(sector => ['akomoses', 'both'].includes(sector.owner)).length;
  const morepudding = active.filter(sector => ['morepudding', 'both'].includes(sector.owner)).length;
  const unassigned = active.filter(sector => !sector.owner).length;
  const responsibilities = `Responsabilités : Akomoses ${akomoses} · morepudding ${morepudding} · ${shared} en commun${unassigned ? ` · ${unassigned} à attribuer` : ''}.`;
  const lines = [`**Le travail du ${date}**`, ''];
  if (!relevant.length) lines.push('Aucun travail déclaré comme terminé ou publié hier.', '');
  const blocks = [];
  for (const [heading, works] of groups) for (const work of works) {
    const actor = work.actor === 'akomoses' ? 'Akomoses' : 'morepudding';
    const status = work.status === 'local' ? 'sur le PC, à publier' : timestampDay(work.completedAt) === yesterday ? 'publié' : 'publication';
    const text = shortSummary(work.summary || work.title);
    blocks.push({ heading, text: `• **${actor}** — ${text} *(${status})*` });
  }
  // One concise Discord message. Excess work stays accessible in the site's full history.
  let shown = 0, previousHeading;
  for (const block of blocks) {
    const extra = block.heading === previousHeading ? [block.text] : [`**${block.heading}**`, block.text];
    const footer = [``, `${blocks.length - shown - 1} autres modifications dans l’historique du site.`, responsibilities, PAGE_URL];
    if ([...lines, ...extra, ...footer].join('\n').length > 1900) break;
    lines.push(...extra); previousHeading = block.heading; shown++;
  }
  if (shown < blocks.length) lines.push('', `+ ${blocks.length - shown} autres modifications dans l’historique du site.`);
  lines.push('', responsibilities, PAGE_URL);
  return lines.join('\n');
}
module.exports = { parisDay, previousDay, workOfDay, summarize };
