import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const currentDir = typeof import.meta.dirname === 'string'
  ? import.meta.dirname
  : fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-extension-assets',
      closeBundle() {
        const outDir = resolve(currentDir, '../dist-extension');
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }
        // Copy manifest.json
        fs.copyFileSync(
          resolve(currentDir, 'manifest.json'),
          resolve(outDir, 'manifest.json')
        );
        // Copy content.css
        if (fs.existsSync(resolve(currentDir, 'src/content.css'))) {
          fs.copyFileSync(
            resolve(currentDir, 'src/content.css'),
            resolve(outDir, 'content.css')
          );
        }
        // Copy popup.css
        if (fs.existsSync(resolve(currentDir, 'popup.css'))) {
          fs.copyFileSync(
            resolve(currentDir, 'popup.css'),
            resolve(outDir, 'popup.css')
          );
        }
        // Copy welcome.css
        if (fs.existsSync(resolve(currentDir, 'welcome.css'))) {
          fs.copyFileSync(
            resolve(currentDir, 'welcome.css'),
            resolve(outDir, 'welcome.css')
          );
        }
        // Copy icons directory
        const iconsDir = resolve(currentDir, 'icons');
        const outIconsDir = resolve(outDir, 'icons');
        if (!fs.existsSync(outIconsDir)) {
          fs.mkdirSync(outIconsDir, { recursive: true });
        }
        if (fs.existsSync(iconsDir)) {
          for (const file of fs.readdirSync(iconsDir)) {
            if (file.endsWith('.png') || file.endsWith('.svg')) {
              fs.copyFileSync(resolve(iconsDir, file), resolve(outIconsDir, file));
            }
          }
        }
      },
    },
  ],
  root: resolve(currentDir),
  build: {
    outDir: resolve(currentDir, '../dist-extension'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(currentDir, 'popup.html'),
        welcome: resolve(currentDir, 'welcome.html'),
        background: resolve(currentDir, 'src/background.ts'),
        content: resolve(currentDir, 'src/content.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background.js';
          if (chunkInfo.name === 'content') return 'content.js';
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
});
