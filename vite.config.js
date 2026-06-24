import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: 'script.js',
      name: 'App',
      formats: ['iife'],
      fileName: () => 'script.js'
    }
  }
});
