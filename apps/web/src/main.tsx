import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { ThemeProvider } from './lib/theme/ThemeProvider';
import '@fontsource/anuphan/400.css';
import '@fontsource/anuphan/600.css';
import '@fontsource/mitr/500.css';
import '@fontsource/mitr/600.css';
import './styles/globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
