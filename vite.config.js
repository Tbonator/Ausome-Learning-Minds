import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Multi-page site: add each new HTML page here so it is included in the build.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        about: resolve(import.meta.dirname, 'about.html'),
        programs: resolve(import.meta.dirname, 'programs.html'),
        findUs: resolve(import.meta.dirname, 'find-us.html'),
        admission: resolve(import.meta.dirname, 'admission.html'),
        apply: resolve(import.meta.dirname, 'apply.html'),
        aftercare: resolve(import.meta.dirname, 'aftercare.html'),
      },
    },
  },
});
