import { create } from 'zustand';
import type { Theme } from '@stockpro/shared';

const KEY = 'stockpro-theme';

function readStored(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(theme: Theme) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useTheme = create<ThemeState>((set) => ({
  theme: readStored(),
  setTheme: (theme) => {
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* storage unavailable: theme still applies for this session */
    }
    applyTheme(theme);
    set({ theme });
  },
}));

window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', () => applyTheme(useTheme.getState().theme));
