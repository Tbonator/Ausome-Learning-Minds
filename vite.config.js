import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Multi-page site: add each new HTML page here so it is included in the build.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        about: resolve(import.meta.dirname, 'about.html'),
      },
    },
  },
});
