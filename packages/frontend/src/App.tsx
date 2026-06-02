import {type ReactNode} from 'react';
import {NavLink, Navigate, Route, Routes, useLocation} from 'react-router-dom';
import {useAuth} from './auth/AuthContext';
import {Spinner} from './components/ui';
import {AuthPage, ConfirmPage} from './pages/AuthPages';
import {DigestsPage} from './pages/DigestsPage';
import {EntitiesPage} from './pages/EntitiesPage';
import {FeedPage} from './pages/FeedPage';
import {FeedsPage} from './pages/FeedsPage';
import {GraphPage} from './pages/GraphPage';
import {SettingsPage} from './pages/SettingsPage';
import {TelemetryPage} from './pages/TelemetryPage';

const navClass = ({isActive}: {isActive: boolean}) =>
  `px-3 py-2 rounded-md text-sm ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`;

function Layout({children}: {children: ReactNode}) {
  const {user, logout} = useAuth();
  return (
    <div className="min-h-full bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <span className="mr-2 font-semibold text-slate-900">
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
          <div className="ml-auto flex items-center gap-3 text-sm text-slate-500">
            <span className="hidden sm:inline">{user?.email}</span>
            <button
              onClick={logout}
              className="rounded-md bg-slate-100 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-200"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
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
