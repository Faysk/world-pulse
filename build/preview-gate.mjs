export function previewUiBuildEnabled(env) {
  return env.VERCEL_ENV === 'preview' && env.WP_PREVIEW_UI === 'true';
}
export function alphaUiBuildEnabled(env){
  return env.VERCEL_ENV==='production'&&env.WP_ALPHA_RELEASE==='true';
}
