const fs = require('node:fs');

const webhook = process.env.DISCORD_WEBHOOK_URL;
if (!webhook) {
  console.log('Discord webhook not configured; asset notification skipped.');
  process.exit(0);
}

const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const changed = new Set((event.commits || []).flatMap(commit => [...(commit.added || []), ...(commit.modified || [])]));
const votingFiles = [...changed].filter(path =>
  /^dist\/assets\/equipment-icons\/.+-(a|b)\.png$/i.test(path) ||
  /^dist\/assets\/audio\/.+\.mp3$/i.test(path)
);
if (!votingFiles.length) {
  console.log('No voting assets changed.');
  process.exit(0);
}

const names = [...new Set(votingFiles.map(path => {
  const file = path.split('/').pop();
  return file.replace(/-(a|b)\.png$/i, '').replace(/\.mp3$/i, '').replace(/[-_]/g, ' ');
}))];
const content = `🎨 **Nouvelles propositions à voter**\n${names.map(name => `• ${name}`).join('\n')}\nhttps://prototype-zero-site.vercel.app/choix.html`;

fetch(webhook, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ content, allowed_mentions: { parse: [] } })
}).then(response => {
  if (!response.ok) throw new Error(`Discord returned ${response.status}`);
  console.log(`Announced ${votingFiles.length} voting assets.`);
}).catch(error => { console.error(error); process.exitCode = 1; });
