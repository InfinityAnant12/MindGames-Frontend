import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Buffer } from 'buffer'; // Required for uuid if not polyfilled by environment

// Polyfill Buffer for environments where it might be missing (like some browser setups for certain libraries)
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
}


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);