import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';

import 'leaflet/dist/leaflet.css';
import './index.css';

import App from './App.tsx';
import { StoreProvider } from './lib/store.tsx';
import './lib/installPrompt.ts'; // capture beforeinstallprompt as early as possible

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <App />
        <Analytics />
      </StoreProvider>
    </BrowserRouter>
  </React.StrictMode>
);
