import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    outDir: 'resources',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'mcp-app': 'src/mcp-app.html',
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  define: {
    'import.meta.env.DEV': JSON.stringify(false),
  },
});
