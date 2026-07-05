import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { I18nProvider } from '../i18n';
import './index.css';

// Adapt layout to the surface: side panel fills the panel, full tab centers
// the wallet column. Toolbar popup keeps the default fixed 400x600.
const view = new URLSearchParams(window.location.search).get('view');
if (view === 'panel' || view === 'tab') {
  document.body.classList.add(`view-${view}`);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>
);
