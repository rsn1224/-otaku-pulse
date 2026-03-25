import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  initTheme: () => void;
}

// システムテーマを取得
const getSystemTheme = (): 'dark' | 'light' => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

// テーマを適用
const applyTheme = (theme: Theme) => {
  const actualTheme = theme === 'system' ? getSystemTheme() : theme;
  const root = document.documentElement;

  if (actualTheme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',

      setTheme: (theme: Theme) => {
        set({ theme });
        applyTheme(theme);
      },

      initTheme: () => {
        const { theme } = get();
        applyTheme(theme);

        // システムテーマ変更をリッスン
        if (typeof window !== 'undefined' && window.matchMedia) {
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
          const handleChange = () => {
            const currentTheme = get().theme;
            if (currentTheme === 'system') {
              applyTheme('system');
            }
          };

          mediaQuery.addEventListener('change', handleChange);
        }
      },
    }),
    {
      name: 'theme-storage',
    },
  ),
);

// アプリ起動時に初期化
export const initTheme = () => {
  useThemeStore.getState().initTheme();
};
