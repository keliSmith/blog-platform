import { create } from 'zustand';

type Theme = 'light' | 'dark';
type Lang = 'zh' | 'en';

interface ThemeState {
  theme: Theme;
  lang: Lang;
  toggleTheme: () => void;
  setLang: (lang: Lang) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: (localStorage.getItem('theme') as Theme) || 'light',
  lang: (localStorage.getItem('lang') as Lang) || 'zh',

  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return { theme: next };
    }),

  setLang: (lang) => {
    localStorage.setItem('lang', lang);
    set({ lang });
  },
}));
