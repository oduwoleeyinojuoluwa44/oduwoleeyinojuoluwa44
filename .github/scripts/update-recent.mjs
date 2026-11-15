// Refreshes the "Recently active" section of README.md with the owner's most recently pushed
// public repositories. Run daily by .github/workflows/recent-activity.yml; also runs locally:
//   node .github/scripts/update-recent.mjs
import { readFile, writeFile } from 'node:fs/promises';

const USER = process.env.GITHUB_USER || 'oduwoleeyinojuoluwa44';
const COUNT = 5;
const README = new URL('../../README.md', import.meta.url);
const START = '<!-- RECENT:START -->';
const END = '<!-- RECENT:END -->';
const TIME_ZONE = 'Africa/Lagos';

const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': `${USER}-profile-readme`,
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {})
};

const res = await fetch(`https://api.github.com/users/${USER}/repos?type=owner&sort=pushed&direction=desc&per_page=30`, { headers });
if (!res.ok) throw new Error(`GitHub API answered ${res.status}: ${await res.text()}`);
const repos = (await res.json())
  .filter((repo) => !repo.fork && !repo.archived && repo.name !== USER)
  .slice(0, COUNT);

const day = (date) => new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric' }).format(date);
const dayKey = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(date); // YYYY-MM-DD

function ago (pushedAt, now) {
  const days = Math.round((Date.parse(dayKey(now)) - Date.parse(dayKey(pushedAt))) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return day(pushedAt);
}

const cell = (text) => String(text ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const shorten = (text, max = 90) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

const now = new Date();
const rows = repos.map((repo) => [
  `[**${cell(repo.name)}**](${repo.html_url})`,
  cell(shorten(repo.description || '—')),
  cell(repo.language || '—'),
  ago(new Date(repo.pushed_at), now)
]);

const section = [
  START,
  '| Repository | What it is | Language | Last push |',
  '|---|---|---|---|',
  ...rows.map((row) => `| ${row.join(' | ')} |`),
  '',
  `<sub>Refreshed automatically on ${day(now)}.</sub>`,
  END
].join('\n');

const readme = await readFile(README, 'utf8');
const startAt = readme.indexOf(START);
const endAt = readme.indexOf(END);
if (startAt === -1 || endAt === -1 || endAt < startAt) throw new Error('README.md has no RECENT:START / RECENT:END markers');

const updated = readme.slice(0, startAt) + section + readme.slice(endAt + END.length);
if (updated !== readme) {
  await writeFile(README, updated);
  console.log(`Updated the Recently active section: ${repos.map((repo) => repo.name).join(', ')}`);
} else {
  console.log('Recently active section already up to date');
}
