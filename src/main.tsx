import React from 'react';
import { createRoot } from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';
import App from './App';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root container');
createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
