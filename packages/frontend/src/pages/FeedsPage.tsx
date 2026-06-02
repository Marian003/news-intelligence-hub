import {useState} from 'react';
import {Badge, Button, ErrorNote, Skeleton, useAsync} from '../components/ui';
import {useToast} from '../components/Toast';
import {api, type Feed} from '../lib/api';

function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : 'never';
}

export function FeedsPage() {
  const feeds = useAsync(() => api.feeds.list(), []);
  const {notify} = useToast();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setError(null);
    try {
      await api.feeds.create(url.trim(), title.trim() || undefined);
      setUrl('');
      setTitle('');
      feeds.reload();
      notify('Feed added', 'success');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const run = async (action: Promise<unknown>, message: string) => {
    try {
      await action;
      notify(message, 'success');
    } catch (err) {
      notify((err as Error).message, 'error');
    }
    feeds.reload();
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        Feeds
      </h1>

      <div className="nih-card p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="flex-1 nih-input px-3 py-2 text-sm"
            placeholder="https://example.com/feed.xml"
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
          <input
            className="nih-input px-3 py-2 text-sm sm:w-48"
            placeholder="Title (optional)"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <Button onClick={add} disabled={!url.trim()}>
            Add feed
          </Button>
        </div>
        {error && (
          <div className="mt-2">
            <ErrorNote message={error} />
          </div>
        )}
      </div>

      {feeds.loading ? (
        <Skeleton rows={3} />
      ) : feeds.error ? (
        <ErrorNote message={feeds.error} />
      ) : feeds.data && feeds.data.length > 0 ? (
        <ul className="space-y-2">
          {feeds.data.map(feed => (
            <FeedRow key={feed.id} feed={feed} onAction={run} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No feeds yet. Add one above.</p>
      )}
    </div>
  );
}

function FeedRow({
  feed,
  onAction,
}: {
  feed: Feed;
  onAction: (action: Promise<unknown>, message: string) => void;
}) {
  return (
    <li className="nih-card p-3 transition hover:border-slate-300 hover:shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge kind="status" value={feed.status} />
        <span className="font-medium text-slate-900 dark:text-slate-100">
          {feed.title ?? feed.url}
        </span>
        <span className="ml-auto flex gap-1">
          <Button
            variant="ghost"
            onClick={() => onAction(api.feeds.refresh(feed.id), 'Poll queued')}
          >
            Poll now
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              onAction(
                api.feeds.update(feed.id, {
                  status: feed.status === 'paused' ? 'active' : 'paused',
                }),
                feed.status === 'paused' ? 'Feed activated' : 'Feed paused'
              )
            }
          >
            {feed.status === 'paused' ? 'Activate' : 'Pause'}
          </Button>
          <Button
            variant="danger"
            onClick={() => onAction(api.feeds.remove(feed.id), 'Feed deleted')}
          >
            Delete
          </Button>
        </span>
      </div>
      <div className="mt-1 truncate text-xs text-slate-400">{feed.url}</div>
      <div className="mt-1 text-xs text-slate-500">
        Last polled: {when(feed.lastPolledAt)}
        {feed.lastError && (
          <span className="ml-2 text-red-600">· {feed.lastError}</span>
        )}
      </div>
    </li>
  );
}
