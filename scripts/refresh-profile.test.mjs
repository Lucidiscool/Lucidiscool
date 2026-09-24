import test from 'node:test';
import assert from 'node:assert/strict';
import { START, END, updateReadme, pinnedSection, calendarSvg } from './refresh-profile.mjs';

const repo = (name, description = null) => ({ name, description, url: `https://github.com/example/${name}`, primaryLanguage: null });
test('refresh follows new pins and order without changing surrounding README', () => {
  const original = `intro\n${START}\nold project\n${END}\nfooter`;
  const updated = updateReadme(original, [repo('second'), repo('first')]);
  assert.ok(updated.startsWith(`intro\n${START}`));
  assert.ok(updated.endsWith(`${END}\nfooter`));
  assert.ok(!updated.includes('old project'));
  assert.ok(updated.indexOf('[second]') < updated.indexOf('[first]'));
  assert.equal(updateReadme(updated, [repo('second'), repo('first')]), updated);
});
test('empty pins, missing metadata, and Markdown in descriptions are safe', () => {
  assert.equal(pinnedSection([]), '_No repositories pinned yet._');
  const section = pinnedSection([repo('example', 'a | b\n<img> [link](x)')]);
  assert.ok(section.includes('a &#124; b &lt;img&gt; \\[link\\](x)'));
  assert.ok(section.endsWith('| — |'));
  assert.throws(() => updateReadme('no markers', []));
});
test('calendar keeps empty days dark and active days green at their weekday positions', () => {
  const svg = calendarSvg({ totalContributions: 2, weeks: [{ contributionDays: [
    { date: '2026-09-20', weekday: 0, contributionCount: 0, contributionLevel: 'NONE' },
    { date: '2026-09-21', weekday: 1, contributionCount: 2, contributionLevel: 'FIRST_QUARTILE' },
  ] }] });
  assert.match(svg, /y="30"[^>]+fill="#21262d"/);
  assert.match(svg, /y="43"[^>]+fill="#0e4429"/);
  assert.ok(svg.includes('2 contributions on 2026-09-21'));
  assert.throws(() => calendarSvg({ weeks: [] }));
});
