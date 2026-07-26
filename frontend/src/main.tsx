import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, theme as antTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import App from './App';
import './index.css';
import { useThemeStore } from './store/themeStore';

// Restore saved theme class on mount
(function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') {
    document.documentElement.classList.add('dark');
  }
  useThemeStore.getState();
})();

function AppWithConfig() {
  const themeMode = useThemeStore((s) => s.theme);
  const lang = useThemeStore((s) => s.lang);

  const locale = useMemo(() => (lang === 'en' ? enUS : zhCN), [lang]);

  const themeConfig = useMemo(() => ({
    algorithm: themeMode === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
    token: {
      colorPrimary: '#1677ff',
      borderRadius: 6,
    },
  }), [themeMode]);

  return (
    <ConfigProvider locale={locale} theme={themeConfig}>
      <App />
    </ConfigProvider>
  );
}

function Root() {
  return (
    <StrictMode>
      <BrowserRouter>
        <AppWithConfig />
      </BrowserRouter>
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
