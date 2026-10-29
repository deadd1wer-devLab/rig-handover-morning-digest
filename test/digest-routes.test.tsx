import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const GOOD = '2026-01-01';
const EMPTY = '2026-01-02';
const BAD = '2026-01-03';
const MISSING = '2026-01-04';

const goodLog = [
  { at: '2026-01-01T01:00:00+01:00', job: 'zeta-sync', status: 'ok', owner: null },
  { at: '2026-01-01T02:00:00+01:00', job: 'alpha-backup', status: 'retry', owner: 'dana', error: 'timeout' },
  { at: '2026-01-01T03:00:00+01:00', job: 'alpha-backup', status: 'ok', owner: 'dana' },
  { at: '2026-01-01T04:00:00+01:00', job: 'mid-report', status: 'fail', owner: 'lee', error: 'boom' },
]
  .map((l) => JSON.stringify(l))
  .join('\n');

const badLog = `${JSON.stringify({ at: '2026-01-03T01:00:00+01:00', job: 'alpha-backup', status: 'ok', owner: 'dana' })}\n{"at":"2026-01-03T02:00:00+01:00","job":"trunc`;

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  writeFileSync(join(dir, `${GOOD}.jsonl`), `${goodLog}\n`);
  writeFileSync(join(dir, `${EMPTY}.jsonl`), '');
  writeFileSync(join(dir, `${BAD}.jsonl`), badLog);
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function json(night: string) {
  const res = await app.request(`/api/digest/${night}`);
  return { res, body: (await res.json()) as Night };
}

function pageJobs(html: string): string[] {
  return [...html.matchAll(/<tr><td>([^<]+)<\/td><td>/g)].map((m) => m[1] ?? '');
}

describe('GET /digest/:night', () => {
  it('200 with the jobs', async () => {
    const res = await app.request(`/digest/${GOOD}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    for (const job of ['alpha-backup', 'mid-report', 'zeta-sync']) expect(html).toContain(job);
    expect(html).not.toContain('nothing ran');
    expect(html).not.toContain('parse');
  });

  it('404 for a night with no file', async () => {
    const res = await app.request(`/digest/${MISSING}`);
    expect(res.status).toBe(404);
    expect(await res.text()).toContain(`no run log for ${MISSING}`);
  });

  it('empty night says nothing ran', async () => {
    const res = await app.request(`/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('bad line: still 200, says it did not parse', async () => {
    const res = await app.request(`/digest/${BAD}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('alpha-backup');
    expect(html).toMatch(/1 line\(s\) in the log didn(&#39;|')t parse/);
  });

  it('null owner renders as a dash', async () => {
    const html = await (await app.request(`/digest/${GOOD}`)).text();
    expect(html).toContain('<td>zeta-sync</td><td>—</td>');
  });
});

describe('GET /api/digest/:night', () => {
  it('200 with the jobs', async () => {
    const { res, body } = await json(GOOD);
    expect(res.status).toBe(200);
    expect(body.night).toBe(GOOD);
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha-backup', 'mid-report', 'zeta-sync']);
    expect(body.rows[0]).toMatchObject({ runs: 2, retries: 1, lastStatus: 'ok', owner: 'dana' });
  });

  it('404 for a night with no file', async () => {
    const { res, body } = await json(MISSING);
    expect(res.status).toBe(404);
    expect(body).toEqual({ error: 'no run log', night: MISSING });
  });

  it('empty night has no rows', async () => {
    const { res, body } = await json(EMPTY);
    expect(res.status).toBe(200);
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('bad line: still 200 with badLines 1', async () => {
    const { res, body } = await json(BAD);
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha-backup']);
  });

  it('null owner is null', async () => {
    const { body } = await json(GOOD);
    expect(body.rows.find((r) => r.job === 'zeta-sync')?.owner).toBeNull();
  });
});

describe('page and JSON agree (ADR 0001)', () => {
  it('list the same jobs in the same order', async () => {
    const html = await (await app.request(`/digest/${GOOD}`)).text();
    const { body } = await json(GOOD);
    expect(pageJobs(html)).toEqual(body.rows.map((r) => r.job));
    expect(pageJobs(html)).toHaveLength(3);
  });
});
