import { describe, expect, it } from 'vitest';
import { digest, parseLine, readNight } from '../src/digest/reader.js';

describe('readNight', () => {
  it('reads 2026-10-28: 5 jobs, 1 bad line', () => {
    const n = readNight('runs', '2026-10-28');
    expect(n).not.toBeNull();
    expect(n!.badLines).toBe(1);
    expect(n!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts runs, retries, last status and last error per job', () => {
    const rows = readNight('runs', '2026-10-28')!.rows;
    const job = (j: string) => rows.find((r) => r.job === j)!;
    expect(job('fixtures/refresh')).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503' });
    expect(job('notes/backup')).toMatchObject({ runs: 1, retries: 0, lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(job('lane/sync')).toMatchObject({ retries: 1, firstAt: '2026-10-28T23:00:06+01:00', lastAt: '2026-10-29T05:00:04+01:00' });
  });

  it('counts parsed lines by status', () => {
    expect(readNight('runs', '2026-10-28')!.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('keeps a row whose owner is null', () => {
    expect(readNight('runs', '2026-10-28')!.rows.find((r) => r.job === 'digest/render')!.owner).toBeNull();
  });

  it('returns null for a night with no file, and for a name that is not a night', () => {
    expect(readNight('runs', '2026-01-01')).toBeNull();
    expect(readNight('runs', '../package')).toBeNull();
  });

  it('an empty file is a night with no rows', () => {
    expect(digest('2026-01-02', '')).toEqual({ night: '2026-01-02', rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } });
  });
});

describe('parseLine', () => {
  it('rejects lines that are not whole run records', () => {
    expect(parseLine('{"at":"2026-10-28T23:00:02+01:00","job":"lane/sy')).toBeNull();
    expect(parseLine('{"at":"x","job":"a","status":"ok","owner":null}')).toBeNull();
    expect(parseLine('{"at":"2026-10-28T23:00:02+01:00","job":"a","status":"done","owner":null}')).toBeNull();
    expect(parseLine('[]')).toBeNull();
  });
});
