import {useState} from 'react';
import {Button, ErrorNote, Spinner, useAsync} from '../components/ui';
import {api, type Axis, type Category} from '../lib/api';

const input = 'rounded-md border border-slate-300 px-3 py-1.5 text-sm';

export function SettingsPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
      <CategoriesSection />
      <AxesSection />
    </div>
  );
}

function CategoriesSection() {
  const categories = useAsync(() => api.categories.list(), []);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setError(null);
    try {
      await api.categories.create(name.trim());
      setName('');
      categories.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const remove = async (id: string) => {
    await api.categories.remove(id);
    categories.reload();
  };

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-slate-800">Categories</h2>
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
        <Spinner />
      ) : (
        <div className="flex flex-wrap gap-2">
          {categories.data?.map((c: Category) => (
            <span
              key={c.id}
              className="flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-sm"
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
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-slate-800">Classification axes</h2>
      <p className="text-sm text-slate-500">
        Axes are sent to the model when articles are analyzed. Editing them
        affects future analyses; use Re-analyze on a feed to refresh existing
        articles.
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
        <Spinner />
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
    <li className="rounded-lg border bg-white p-3">
      <div className="flex items-center gap-2">
        <span className="font-medium text-slate-900">{axis.name}</span>
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
              className="rounded bg-slate-100 px-1.5 py-0.5 text-xs"
            >
              {v}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}
