import { defineConfig } from 'vite';
import { previewUiBuildEnabled } from './build/preview-gate.mjs';

export default defineConfig({
  define: { __WP_PREVIEW_UI__: JSON.stringify(previewUiBuildEnabled(process.env)) }
});
