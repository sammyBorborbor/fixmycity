import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';

import './lib/image-slot.js'; // registers the <image-slot> custom element
import './index.css';

import App from './App.tsx';
import { StoreProvider } from './lib/store.tsx';

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
