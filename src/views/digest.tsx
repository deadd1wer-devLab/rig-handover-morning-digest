import type { Night } from '../digest/types.js';

const dash = '—';

export function DigestPage({ night }: { night: Night }) {
  const { rows, badLines } = night;
  return (
    <>
      <h1>digest · {night.night}</h1>
      {rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr>
                <td>{r.job}</td>
                <td>{r.owner ?? dash}</td>
                <td>{r.runs}</td>
                <td class={r.retries >= 3 ? 'warn' : undefined}>{r.retries}</td>
                <td class={r.fails > 0 ? 'warn' : undefined}>
                  {r.lastStatus}
                  {r.fails > 0 && r.lastStatus !== 'fail' ? ` (failed ${r.fails}×)` : ''}
                </td>
                <td>{r.lastError ?? dash}</td>
                <td>{r.firstAt}</td>
                <td>{r.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {badLines > 0 ? <p class="mute">{badLines} line(s) in the log didn't parse</p> : null}
    </>
  );
}

export function DigestMissing({ night }: { night: string }) {
  return <p>no run log for {night}</p>;
}
