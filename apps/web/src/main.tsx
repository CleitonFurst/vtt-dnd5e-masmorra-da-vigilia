import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './hud/ErrorBoundary';
import './styles.css';

const showCrash = (title: string, detail: string): void => {
  const el = document.getElementById('crash') as HTMLElement | null;
  if (!el) return;
  el.style.display = 'grid';
  const box = el.querySelector('.crash-box pre');
  if (box) box.textContent = `${title}\n\n${detail}`;
};

window.addEventListener('error', (e) => showCrash(e.message, `${e.filename}:${e.lineno}`));
window.addEventListener('unhandledrejection', (e) => showCrash('Promise rejeitada', String(e.reason)));

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
