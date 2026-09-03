import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Für GitHub Pages liegt die App unter https://<user>.github.io/<repo>/.
// Der Basispfad lässt sich beim Build über BASE_PATH überschreiben
// (z.B. BASE_PATH=/ für Netlify, Vercel oder eine eigene Domain).
const base = process.env.BASE_PATH ?? '/ai-tandem/';

export default defineConfig({
  base,
  plugins: [react()],
});
