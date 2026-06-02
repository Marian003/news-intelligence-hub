import {useEffect, useState} from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'nih-theme';

/** The theme currently applied to <html> (set pre-paint in index.html). */
function current(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function apply(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem(KEY, theme);
}

/**
 * Theme state synced with the `dark` class on <html>. Initial value comes from
 * what the pre-paint script set (saved choice or OS preference); toggling
 * persists the explicit choice.
 */
export function useTheme(): {theme: Theme; toggle: () => void} {
  const [theme, setTheme] = useState<Theme>(current);

  // Follow OS changes only while the user has not made an explicit choice.
  useEffect(() => {
    if (localStorage.getItem(KEY)) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('dark', e.matches);
      setTheme(e.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    apply(next);
    setTheme(next);
  };

  return {theme, toggle};
}
