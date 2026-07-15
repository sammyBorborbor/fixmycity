import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';

import 'leaflet/dist/leaflet.css';
import './index.css';

import App from './App.tsx';
import { StoreProvider } from './lib/store.tsx';
import { ToastProvider } from './components/Toast.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <ToastProvider>
          <App />
          <Analytics />
        </ToastProvider>
      </StoreProvider>
    </BrowserRouter>
  </React.StrictMode>
);
