import { create } from 'zustand';
import type { Theme } from '@stockpro/shared';
import { storage } from '@/plugins/storage.plugin';

const KEY = 'theme';

function readStored(): Theme {
  const v = storage.getString(KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'dark';
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
    storage.setString(KEY, theme);
    applyTheme(theme);
    set({ theme });
  },
}));

window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', () => applyTheme(useTheme.getState().theme));
