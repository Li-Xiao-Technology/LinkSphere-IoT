import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  effectiveTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  initTheme: () => void;
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function applyTheme(theme: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'system',
  effectiveTheme: 'light',

  setTheme: (theme: Theme) => {
    const effective = theme === 'system' ? getSystemTheme() : theme;
    applyTheme(effective);
    localStorage.setItem('theme', theme);
    set({ theme, effectiveTheme: effective });
  },

  initTheme: () => {
    const saved = localStorage.getItem('theme') as Theme | null;
    const theme = saved || 'system';
    const effective = theme === 'system' ? getSystemTheme() : theme;
    applyTheme(effective);
    set({ theme, effectiveTheme: effective });

    // Listen for system theme changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (get().theme === 'system') {
          const newEffective = e.matches ? 'dark' : 'light';
          applyTheme(newEffective);
          set({ effectiveTheme: newEffective });
        }
      });
    }
  },
}));
