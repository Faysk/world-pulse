export function previewUiBuildEnabled(env) {
  return env.VERCEL_ENV === 'preview' && env.WP_PREVIEW_UI === 'true';
}
