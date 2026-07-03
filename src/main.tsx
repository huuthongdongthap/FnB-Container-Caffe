import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/global.css';
import { injectBrandTheme } from './config/brand-theme';
import { onLCP, onCLS, onINP, onTTFB, onFCP } from 'web-vitals';

function sendToAnalytics(metric: { name: string, value: number, rating: string }) {
  const body = JSON.stringify({ name: metric.name, value: metric.value, rating: metric.rating });
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/vitals', body);
  } else {
    fetch('/api/vitals', { method: 'POST', body, keepalive: true });
  }
}

// Initialize
injectBrandTheme();
onLCP(sendToAnalytics);
onFCP(sendToAnalytics);
onCLS(sendToAnalytics);
onINP(sendToAnalytics);
onTTFB(sendToAnalytics);

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
