import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { useThemeStore } from './store/themeStore';
import './i18n';
import './index.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

// 初始化主题
useThemeStore.getState().initTheme();

root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

// 强制清除旧 Service Worker 和缓存，只执行一次
const SW_CLEANED_KEY = '__sw_cleaned_20250706__';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      const hasOldSW = registrations.length > 0;
      if (hasOldSW && !localStorage.getItem(SW_CLEANED_KEY)) {
        Promise.all([
          ...registrations.map((r) => r.unregister()),
          caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n)))),
        ]).then(() => {
          localStorage.setItem(SW_CLEANED_KEY, 'true');
          window.location.reload();
        }).catch(() => {
          localStorage.setItem(SW_CLEANED_KEY, 'true');
          window.location.reload();
        });
      }
    });
  });
}
