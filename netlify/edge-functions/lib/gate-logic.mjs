// Чиста (без Deno.env/fetch/Response) частина логіки gate-content.js — винесена окремо, щоб її можна
// було перевірити звичайним Node-тестом (v2/mvp/tests/gate-content-test.mjs). Пісочниця розробки не
// має мережевого доступу для завантаження рантайму Netlify Edge Functions (403 з проксі), тож повний
// прогін самої edge-функції тут неможливий — ця частина є єдиним автоматично перевіреним шматком.
export const PUBLIC_PATHS = new Set(['/', '/account.html', '/sw.js', '/favicon.ico']);

export function isPublicPath(path) {
  return PUBLIC_PATHS.has(path) || path.startsWith('/assets/');
}
