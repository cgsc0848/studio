import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error handler for diagnostic
window.onerror = (message, source, lineno, colno, error) => {
  console.error('Global Error:', { message, source, lineno, colno, error });
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
