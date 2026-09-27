// Ikorka Shop — зріз 5: гейтинг контенту курсу за сесією Supabase.
// Вимога власника (PUBLIC_DEPLOY_PLAN.md, п.4): статичні сторінки на Netlify CDN самі по собі публічні,
// клієнтського JS для розмежування недостатньо (URL уроку відкривається напряму) — тому перевірка тут,
// на межі CDN, ДО того, як сторінка взагалі віддається.
//
// Сесія Supabase зберігається у браузері в localStorage (не в куці) — edge-функція його не бачить.
// account.js (assets/account.js) додатково дзеркалить access_token у куку `sb_at` при кожній зміні
// сесії (вхід/оновлення токена/вихід) — саме її тут і перевіряємо, зверненням до GoTrue (/auth/v1/user),
// а не декодуванням JWT самотужки: так гарантовано ловимо і протухлий, і відкликаний токен.
//
// Публічно без сесії: account.html (сама форма входу), корінь /assets/* (стилі/скрипти/шрифти/вендор —
// інакше форма входу сама не завантажиться), sw.js, favicon. isPublicPath() винесено в lib/gate-logic.mjs
// (перевіряється звичайним Node-тестом — v2/mvp/tests/gate-content-test.mjs), тут лише підключається.
import { isPublicPath } from './lib/gate-logic.mjs';

export default async (request, context) => {
  const url = new URL(request.url);
  const path = url.pathname;

  if (isPublicPath(path)) return context.next();

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  // Акаунти вимкнені при збірці (немає цих змінних і в Netlify Environment variables) — сайт як і
  // раніше офлайн-only, гейтингу без облікових записів немає сенсу.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return context.next();

  const cookieHeader = request.headers.get('cookie') || '';
  const m = /(?:^|;\s*)sb_at=([^;]+)/.exec(cookieHeader);
  const token = m ? decodeURIComponent(m[1]) : null;
  if (!token) return Response.redirect(new URL('/account.html', url), 302);

  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${token}` },
    });
    if (!r.ok) return Response.redirect(new URL('/account.html', url), 302);
  } catch (e) {
    // Supabase тимчасово недосяжний — не блокуємо курс через мережевий збій самого гейтингу.
    return context.next();
  }
  return context.next();
};

export const config = { path: '/*' };
