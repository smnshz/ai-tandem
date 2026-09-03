import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LucideProvider } from 'lucide-react';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Ein Ort für Größe und Strichstärke aller Icons – so bleibt das
        Icon-Set über die ganze App hinweg einheitlich. */}
    <LucideProvider size={18} strokeWidth={1.75}>
      <App />
    </LucideProvider>
  </StrictMode>,
);
