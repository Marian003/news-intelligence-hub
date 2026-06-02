import {type ReactNode} from 'react';
import {NavLink, Navigate, Route, Routes, useLocation} from 'react-router-dom';
import {useAuth} from './auth/AuthContext';
import {Spinner} from './components/ui';
import {useTheme} from './lib/theme';
import {AuthPage, ConfirmPage} from './pages/AuthPages';
import {DigestsPage} from './pages/DigestsPage';
import {EntitiesPage} from './pages/EntitiesPage';
import {FeedPage} from './pages/FeedPage';
import {FeedsPage} from './pages/FeedsPage';
import {GraphPage} from './pages/GraphPage';
import {SettingsPage} from './pages/SettingsPage';
import {TelemetryPage} from './pages/TelemetryPage';

const navClass = ({isActive}: {isActive: boolean}) =>
  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive
      ? 'bg-indigo-600 text-white shadow-sm'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 ' +
        'dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
  }`;

function ThemeToggle() {
  const {theme, toggle} = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
      className="rounded-md border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  );
}

function Layout({children}: {children: ReactNode}) {
  const {user, logout} = useAuth();
  return (
    <div className="theme-transition min-h-full">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <span className="mr-2 flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
            <span className="h-5 w-5 rounded-md bg-gradient-to-br from-indigo-500 to-violet-500 shadow-sm" />
            News Intelligence Hub
          </span>
          <nav className="flex flex-wrap gap-1">
            <NavLink to="/" end className={navClass}>
              Feed
            </NavLink>
            <NavLink to="/graph" className={navClass}>
              Graph
            </NavLink>
            <NavLink to="/entities" className={navClass}>
              Entities
            </NavLink>
            <NavLink to="/digests" className={navClass}>
              Digests
            </NavLink>
            <NavLink to="/feeds" className={navClass}>
              Feeds
            </NavLink>
            <NavLink to="/settings" className={navClass}>
              Settings
            </NavLink>
            <NavLink to="/telemetry" className={navClass}>
              Telemetry
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
            <span className="hidden sm:inline">{user?.email}</span>
            <ThemeToggle />
            <button
              onClick={logout}
              className="rounded-md bg-slate-100 px-3 py-1.5 font-medium text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="theme-transition mx-auto max-w-6xl px-4 py-6">
        {children}
      </main>
    </div>
  );
}

function Protected({children}: {children: ReactNode}) {
  const {user, loading} = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{from: location}} replace />;
  return <Layout>{children}</Layout>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/confirm" element={<ConfirmPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <FeedPage />
          </Protected>
        }
      />
      <Route
        path="/graph"
        element={
          <Protected>
            <GraphPage />
          </Protected>
        }
      />
      <Route
        path="/entities"
        element={
          <Protected>
            <EntitiesPage />
          </Protected>
        }
      />
      <Route
        path="/feeds"
        element={
          <Protected>
            <FeedsPage />
          </Protected>
        }
      />
      <Route
        path="/settings"
        element={
          <Protected>
            <SettingsPage />
          </Protected>
        }
      />
      <Route
        path="/digests"
        element={
          <Protected>
            <DigestsPage />
          </Protected>
        }
      />
      <Route
        path="/telemetry"
        element={
          <Protected>
            <TelemetryPage />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
