import {useEffect, useState} from 'react';
import {Button, ErrorNote, Skeleton, useAsync} from '../components/ui';
import {useToast} from '../components/Toast';
import {api, type Axis, type Category} from '../lib/api';

const input = 'nih-input px-3 py-1.5 text-sm';

export function SettingsPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        Settings
      </h1>
      <CategoriesSection />
      <AxesSection />
      <RegenerateSection />
    </div>
  );
}

function RegenerateSection() {
  const {notify} = useToast();
  const [enqueued, setEnqueued] = useState(0);
  const [inProgress, setInProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(async () => {
      try {
        const status = await api.regenerate.status();
        setInProgress(status.inProgress);
        if (status.inProgress === 0) setRunning(false);
      } catch {
        setRunning(false);
      }
    }, 1500);
    return () => clearInterval(id);
  }, [running]);

  const start = async () => {
    setError(null);
    try {
      const result = await api.regenerate.start();
      setEnqueued(result.enqueued);
      setInProgress(result.enqueued);
      setRunning(result.enqueued > 0);
      notify(
        result.enqueued > 0
          ? `Re-analyzing ${result.enqueued} article(s)…`
          : 'No processed articles to re-analyze',
        result.enqueued > 0 ? 'success' : 'info'
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const done = enqueued - inProgress;
  const percent = enqueued > 0 ? Math.round((done / enqueued) * 100) : 0;

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-slate-800 dark:text-slate-200">
        Re-analyze articles
      </h2>
      <p className="text-sm text-slate-500">
        After changing axes or categories, re-run the LLM analysis of your
        stored articles under the new set. It runs in the background — the app
        stays usable — and the graph reflects the new markup when it finishes.
      </p>
      <Button onClick={start} disabled={running}>
        {running ? `Re-analyzing… ${percent}%` : 'Re-analyze all articles'}
      </Button>
      {running && (
        <div className="h-2 w-full max-w-md overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full bg-indigo-600 transition-all"
            style={{width: `${percent}%`}}
          />
        </div>
      )}
      {!running && enqueued > 0 && inProgress === 0 && (
        <p className="text-sm text-green-700">
          Re-analyzed {enqueued} article(s).
        </p>
      )}
      {error && <ErrorNote message={error} />}
    </section>
  );
}

function CategoriesSection() {
  const categories = useAsync(() => api.categories.list(), []);
  const {notify} = useToast();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setError(null);
    try {
      await api.categories.create(name.trim());
      setName('');
      categories.reload();
      notify('Category added', 'success');
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const remove = async (id: string) => {
    await api.categories.remove(id);
    categories.reload();
    notify('Category deleted', 'success');
  };

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-slate-800 dark:text-slate-200">
        Categories
      </h2>
      <div className="flex gap-2">
        <input
          className={input}
          placeholder="New category"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <Button onClick={add} disabled={!name.trim()}>
          Add
        </Button>
      </div>
      {error && <ErrorNote message={error} />}
      {categories.loading ? (
        <Skeleton rows={2} />
      ) : (
        <div className="flex flex-wrap gap-2">
          {categories.data?.map((c: Category) => (
            <span
              key={c.id}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {c.name}
              <button
                onClick={() => remove(c.id)}
                className="text-slate-400 hover:text-red-600"
              >
                ✕
              </button>
            </span>
          ))}
          {categories.data?.length === 0 && (
            <p className="text-sm text-slate-500">No categories yet.</p>
          )}
        </div>
      )}
    </section>
  );
}

function AxesSection() {
  const axes = useAsync(() => api.axes.list(), []);
  const {notify} = useToast();
  const [name, setName] = useState('');
  const [values, setValues] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setError(null);
    try {
      const list = values
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
      await api.axes.create(name.trim(), list);
      setName('');
      setValues('');
      axes.reload();
      notify('Axis added', 'success');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-slate-800 dark:text-slate-200">
        Classification axes
      </h2>
      <p className="text-sm text-slate-500">
        Axes are sent to the model when articles are analyzed. Editing them
        affects future analyses; use “Re-analyze all articles” below to refresh
        already-stored articles under the new set.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          className={input}
          placeholder="Axis name"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <input
          className={`${input} flex-1`}
          placeholder="Comma-separated values"
          value={values}
          onChange={e => setValues(e.target.value)}
        />
        <Button onClick={add} disabled={!name.trim() || !values.trim()}>
          Add axis
        </Button>
      </div>
      {error && <ErrorNote message={error} />}
      {axes.loading ? (
        <Skeleton rows={2} />
      ) : (
        <ul className="space-y-2">
          {axes.data?.map((axis: Axis) => (
            <AxisRow key={axis.id} axis={axis} onChange={() => axes.reload()} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AxisRow({axis, onChange}: {axis: Axis; onChange: () => void}) {
  const [values, setValues] = useState(axis.values.join(', '));
  const [editing, setEditing] = useState(false);

  const save = async () => {
    await api.axes.update(axis.id, {
      values: values
        .split(',')
        .map(v => v.trim())
        .filter(Boolean),
    });
    setEditing(false);
    onChange();
  };

  return (
    <li className="nih-card p-3">
      <div className="flex items-center gap-2">
        <span className="font-medium text-slate-900 dark:text-slate-100">
          {axis.name}
        </span>
        <span className="ml-auto flex gap-1">
          <Button variant="ghost" onClick={() => setEditing(v => !v)}>
            {editing ? 'Cancel' : 'Edit'}
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              await api.axes.remove(axis.id);
              onChange();
            }}
          >
            Delete
          </Button>
        </span>
      </div>
      {editing ? (
        <div className="mt-2 flex gap-2">
          <input
            className={`${input} flex-1`}
            value={values}
            onChange={e => setValues(e.target.value)}
          />
          <Button onClick={save}>Save</Button>
        </div>
      ) : (
        <div className="mt-1 flex flex-wrap gap-1">
          {axis.values.map(v => (
            <span
              key={v}
              className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs"
            >
              {v}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}
