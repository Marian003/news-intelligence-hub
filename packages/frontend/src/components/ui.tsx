import {useEffect, useState, type ReactNode} from 'react';

/** Tiny data-fetching hook: runs `fn` when `deps` change, with reload support. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{
    data?: T;
    loading: boolean;
    error: string | null;
  }>({loading: true, error: null});
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    setState(prev => ({...prev, loading: true, error: null}));
    fn()
      .then(data => active && setState({data, loading: false, error: null}))
      .catch(
        (err: Error) =>
          active &&
          setState({data: undefined, loading: false, error: err.message})
      );
    return () => {
      active = false;
    };
    // fn is intentionally excluded; callers pass the real inputs via deps.
  }, [...deps, tick]);

  return {...state, reload: () => setTick(t => t + 1)};
}

export function Spinner() {
  return (
    <div className="flex items-center gap-2 p-6 text-sm text-slate-400">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
      Loading…
    </div>
  );
}

/** Placeholder rows shown while a list loads, to avoid layout jumps. */
export function Skeleton({rows = 4}: {rows?: number}) {
  return (
    <div className="space-y-2">
      {Array.from({length: rows}).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}

export function ErrorNote({message}: {message: string}) {
  return (
    <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  const styles = {
    primary: 'bg-slate-900 text-white hover:bg-slate-700',
    ghost: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    danger: 'bg-red-600 text-white hover:bg-red-500',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${styles[variant]}`}
    >
      {children}
    </button>
  );
}

const IMPORTANCE_STYLE: Record<string, string> = {
  high: 'bg-amber-100 text-amber-800',
  normal: 'bg-slate-100 text-slate-600',
  junk: 'bg-slate-100 text-slate-400',
};
const STATUS_STYLE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-slate-100 text-slate-500',
  error: 'bg-red-100 text-red-700',
  processed: 'bg-green-100 text-green-700',
  pending: 'bg-blue-100 text-blue-700',
  processing: 'bg-blue-100 text-blue-700',
  filtered: 'bg-slate-100 text-slate-400',
  failed: 'bg-red-100 text-red-700',
};

export function Badge({
  kind,
  value,
}: {
  kind: 'importance' | 'status';
  value: string;
}) {
  const map = kind === 'importance' ? IMPORTANCE_STYLE : STATUS_STYLE;
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs font-medium ${map[value] ?? 'bg-slate-100 text-slate-600'}`}
    >
      {value}
    </span>
  );
}

export function formatTs(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString();
}
