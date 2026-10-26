import { defineConfig } from 'vite';
import { previewUiBuildEnabled,alphaUiBuildEnabled } from './build/preview-gate.mjs';
import {searchPresence} from './build/search-presence.mjs';

export default defineConfig({
  plugins:[searchPresence(process.env)],
  define: { __WP_PREVIEW_UI__: JSON.stringify(previewUiBuildEnabled(process.env)),__WP_ALPHA_RELEASE__:JSON.stringify(alphaUiBuildEnabled(process.env)) }
});
