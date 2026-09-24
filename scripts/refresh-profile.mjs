import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const START = '<!-- PINNED-PROJECTS:START -->';
export const END = '<!-- PINNED-PROJECTS:END -->';
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const cell = value => escape(value).replace(/\|/g, '&#124;').replace(/[\r\n]+/g, ' ').replace(/([\\`*_\[\]])/g, '\\$1');

export function pinnedSection(repositories) {
  if (!repositories.length) return '_No repositories pinned yet._';
  return [
    '| Project | What it\'s about | Built with |',
    '| :--- | :--- | :--- |',
    ...repositories.map(repo => {
      const url = new URL(repo.url);
      if (url.origin !== 'https://github.com') throw new Error('Unexpected repository URL');
      return `| [${cell(repo.name)}](${url.href}) | ${cell(repo.description || '—')} | ${cell(repo.primaryLanguage?.name || '—')} |`;
    }),
  ].join('\n');
}

export function updateReadme(readme, repositories) {
  if (readme.split(START).length !== 2 || readme.split(END).length !== 2) throw new Error('Expected one pair of pinned-project markers');
  const start = readme.indexOf(START) + START.length;
  const end = readme.indexOf(END);
  if (end < start) throw new Error('Pinned-project markers out of order');
  return readme.slice(0, start) + '\n\n' + pinnedSection(repositories) + '\n\n' + readme.slice(end);
}

export function calendarSvg(calendar) {
  const colors = { NONE: '#21262d', FIRST_QUARTILE: '#0e4429', SECOND_QUARTILE: '#006d32', THIRD_QUARTILE: '#26a641', FOURTH_QUARTILE: '#39d353' };
  if (!calendar.weeks?.length) throw new Error('Missing contribution calendar');
  const width = 64 + calendar.weeks.length * 13;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="164" viewBox="0 0 ${width} 164" role="img" aria-labelledby="title desc">`,
    '<title id="title">GitHub contribution calendar</title>',
    `<desc id="desc">${calendar.totalContributions} contributions in the past year. Dark gray squares indicate no contributions; brighter green squares indicate more contributions.</desc>`,
    `<rect width="${width}" height="164" rx="8" fill="#0d1117"/>`,
    '<g font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="10" fill="#8b949e">',
  ];
  let month = '';
  calendar.weeks.forEach((week, column) => {
    const first = week.contributionDays[0];
    if (!first) throw new Error('Empty calendar week');
    const date = new Date(first.date + 'T00:00:00Z');
    const label = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    if (label !== month && column < calendar.weeks.length - 2) {
      svg.push(`<text x="${38 + column * 13}" y="21">${label}</text>`);
      month = label;
    }
    for (const day of week.contributionDays) {
      if (!colors[day.contributionLevel] || day.weekday < 0 || day.weekday > 6 || !Number.isInteger(day.contributionCount)) throw new Error('Invalid contribution day');
      svg.push(`<rect x="${38 + column * 13}" y="${30 + day.weekday * 13}" width="10" height="10" rx="2" fill="${colors[day.contributionLevel]}" stroke="#30363d" stroke-width="0.5"><title>${day.contributionCount} contributions on ${escape(day.date)}</title></rect>`);
    }
  });
  for (const [label, row] of [['Mon', 1], ['Wed', 3], ['Fri', 5]]) svg.push(`<text x="8" y="${38 + row * 13}">${label}</text>`);
  svg.push(`<text x="38" y="146">${calendar.totalContributions} contributions in the past year</text>`);
  svg.push(`<text x="${width - 141}" y="146">Less</text>`);
  Object.values(colors).forEach((color, i) => svg.push(`<rect x="${width - 113 + i * 13}" y="137" width="10" height="10" rx="2" fill="${color}" stroke="#30363d" stroke-width="0.5"/>`));
  svg.push(`<text x="${width - 43}" y="146">More</text>`, '</g>', '</svg>');
  return svg.join('\n') + '\n';
}

function main() {
  const owner = process.env.PROFILE_OWNER || 'Lucidiscool';
  const query = `query($login: String!) { user(login: $login) {
    pinnedItems(first: 6, types: REPOSITORY) { nodes { ... on Repository { name description url primaryLanguage { name } } } }
    contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date weekday contributionCount contributionLevel } } } }
  } }`;
  const response = JSON.parse(execFileSync('gh', ['api', 'graphql', '-f', `query=${query}`, '-f', `login=${owner}`], { encoding: 'utf8' }));
  if (response.errors || !response.data?.user) throw new Error('GitHub did not return a complete profile');
  const user = response.data.user;
  const root = fileURLToPath(new URL('../', import.meta.url));
  const readmePath = resolve(root, 'README.md');
  // Build both outputs before writing, so failed API data preserves the previous files.
  const readme = updateReadme(readFileSync(readmePath, 'utf8'), user.pinnedItems.nodes);
  const svg = calendarSvg(user.contributionsCollection.contributionCalendar);
  mkdirSync(resolve(root, 'assets'), { recursive: true });
  writeFileSync(resolve(root, 'assets/contributions.svg'), svg);
  writeFileSync(readmePath, readme);
  console.log(`Refreshed ${user.pinnedItems.nodes.length} pinned repositories and contribution calendar.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
