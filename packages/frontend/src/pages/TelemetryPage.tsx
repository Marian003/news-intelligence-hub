import {ErrorNote, Skeleton, useAsync} from '../components/ui';
import {api} from '../lib/api';

const OPERATION_LABELS: Record<string, string> = {
  processing: 'Article processing',
  regeneration: 'Regeneration',
  digest: 'Digests',
};

/** Read-only dashboard of LLM call/token spend per operation (FR-10). */
export function TelemetryPage() {
  const usage = useAsync(() => api.telemetry.llm(), []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        LLM telemetry
      </h1>
      <p className="text-sm text-slate-500">
        Every real provider call is recorded. Cache hits and pre-filtered
        articles never reach the model, so they do not appear here.
      </p>

      {usage.loading ? (
        <Skeleton rows={4} />
      ) : usage.error ? (
        <ErrorNote message={usage.error} />
      ) : usage.data ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Total calls" value={usage.data.totals.calls} />
            <Stat
              label="Prompt tokens"
              value={usage.data.totals.promptTokens}
            />
            <Stat
              label="Completion tokens"
              value={usage.data.totals.completionTokens}
            />
          </div>

          <div className="overflow-x-auto nih-card">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2">Operation</th>
                  <th className="px-4 py-2 text-right">Calls</th>
                  <th className="px-4 py-2 text-right">Prompt</th>
                  <th className="px-4 py-2 text-right">Completion</th>
                  <th className="px-4 py-2 text-right">Total tokens</th>
                </tr>
              </thead>
              <tbody>
                {usage.data.byOperation.map(row => (
                  <tr key={row.operation} className="border-t">
                    <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200">
                      {OPERATION_LABELS[row.operation] ?? row.operation}
                    </td>
                    <td className="px-4 py-2 text-right">{row.calls}</td>
                    <td className="px-4 py-2 text-right">{row.promptTokens}</td>
                    <td className="px-4 py-2 text-right">
                      {row.completionTokens}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      {row.totalTokens}
                    </td>
                  </tr>
                ))}
                {usage.data.byOperation.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      No LLM calls recorded yet. Poll a feed or re-analyze to
                      generate activity.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({label, value}: {label: string; value: number}) {
  return (
    <div className="nih-card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {value.toLocaleString()}
      </div>
    </div>
  );
}
