import {useState, type FormEvent, type ReactNode} from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import {useAuth} from '../auth/AuthContext';
import {Button, ErrorNote, useAsync} from '../components/ui';
import {api, ApiError, type RegisterResult} from '../lib/api';

function CenterCard({title, children}: {title: string; children: ReactNode}) {
  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-lg font-semibold text-slate-900">{title}</h1>
        {children}
      </div>
    </div>
  );
}

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none';

export function AuthPage({mode}: {mode: 'login' | 'register'}) {
  const {login} = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as {state?: {from?: {pathname: string}}};
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState<RegisterResult | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        navigate(location.state?.from?.pathname ?? '/', {replace: true});
      } else {
        setRegistered(await api.register(email, password));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  if (registered) {
    return (
      <CenterCard title="Almost there">
        <p className="mb-3 text-sm text-slate-600">
          No real email is sent in development. Use this confirmation link:
        </p>
        {registered.confirmationUrl ? (
          <a
            href={registered.confirmationUrl}
            className="block break-all rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800"
          >
            <span className="font-semibold">DEV MODE · </span>
            {registered.confirmationUrl}
          </a>
        ) : (
          <p className="text-sm text-slate-500">Check the service log.</p>
        )}
        <p className="mt-4 text-sm">
          <Link to="/login" className="font-medium text-slate-900 underline">
            Back to log in
          </Link>
        </p>
      </CenterCard>
    );
  }

  return (
    <CenterCard title={mode === 'login' ? 'Log in' : 'Create account'}>
      <form onSubmit={submit} className="space-y-3">
        <input
          className={inputClass}
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          className={inputClass}
          type="password"
          placeholder="Password (min 8 chars)"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        {error && <ErrorNote message={error} />}
        <Button type="submit" disabled={busy}>
          {busy ? '…' : mode === 'login' ? 'Log in' : 'Register'}
        </Button>
      </form>
      <p className="mt-4 text-sm text-slate-500">
        {mode === 'login' ? (
          <>
            No account?{' '}
            <Link
              to="/register"
              className="font-medium text-slate-900 underline"
            >
              Register
            </Link>
          </>
        ) : (
          <>
            Have an account?{' '}
            <Link to="/login" className="font-medium text-slate-900 underline">
              Log in
            </Link>
          </>
        )}
      </p>
    </CenterCard>
  );
}

export function ConfirmPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const {loading, error} = useAsync(
    () =>
      token
        ? api.confirm(token)
        : Promise.reject(new Error('Missing confirmation token')),
    [token]
  );

  return (
    <CenterCard title="Email confirmation">
      {loading ? (
        <p className="text-sm text-slate-500">Confirming…</p>
      ) : error ? (
        <ErrorNote message={error} />
      ) : (
        <p className="text-sm text-green-700">
          Your email is confirmed. You can log in now.
        </p>
      )}
      <p className="mt-4 text-sm">
        <Link to="/login" className="font-medium text-slate-900 underline">
          Go to log in
        </Link>
      </p>
    </CenterCard>
  );
}
