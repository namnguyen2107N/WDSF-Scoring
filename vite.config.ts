import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function createStandaloneHtml(): Plugin {
  return {
    name: 'create-standalone-html',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter((item) => item.type === 'chunk');
      const entry = chunks.find((chunk) => chunk.isEntry);
      if (!entry) {
        throw new Error('Bản HTML độc lập cần một JavaScript bundle.');
      }

      const styles = Object.values(bundle).filter(
        (item) => item.type === 'asset' && item.fileName.endsWith('.css'),
      );
      const inlineScript = `<script>${entry.code.replace(/<\/script/gi, '<\\/script')}</script>`;
      const inlineStyles: string[] = [];
      for (const style of styles) {
        if (style.type !== 'asset') continue;
        inlineStyles.push(`<style>${String(style.source)}</style>`);
        delete bundle[style.fileName];
      }

      const html = `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#1d4ed8" />
    <meta name="description" content="Hệ thống chấm điểm giải khiêu vũ thể thao theo tiêu chuẩn WDSF. Hoạt động offline, dữ liệu lưu trên trình duyệt." />
    <title>WDSF Scoring · Chấm điểm khiêu vũ thể thao</title>
    ${inlineStyles.join('\n    ')}
  </head>
  <body>
    <div id="root"></div>
    ${inlineScript}
  </body>
</html>`;
      this.emitFile({ type: 'asset', fileName: 'index.html', source: html });
      for (const chunk of chunks) delete bundle[chunk.fileName];
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [react(), createStandaloneHtml()],
  define:
    command === 'build'
      ? { 'process.env.NODE_ENV': JSON.stringify('production') }
      : {},
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
  base: './',
  build: {
    minify: true,
    lib: {
      entry: 'src/main.tsx',
      name: 'WDSFScoring',
      formats: ['iife'],
      fileName: () => 'app.js',
      cssFileName: 'app',
    },
    cssCodeSplit: false,
  },
}));
