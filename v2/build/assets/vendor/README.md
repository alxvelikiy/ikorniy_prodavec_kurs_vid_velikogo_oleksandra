# vendor/ — вендоровані сторонні бібліотеки

Файли тут копіюються вручну з npm, а не тягнуться з CDN у рантаймі браузера — щоб продакшн і тести
завжди використовували один і той самий файл (перевірено: `cdn.jsdelivr.net` недоступний з деяких
робочих середовищ через мережеву політику, а версія з CDN може розійтися з версією, проти якої
писались тести). `v2/build/build.mjs` копіює весь `v2/build/assets/*` у збірку як є — цей файл
підключається лише коли акаунти ввімкнено (`SUPABASE_URL`/`SUPABASE_ANON_KEY` задані при збірці).

## supabase-js.js

- Джерело: npm-пакет `@supabase/supabase-js`, версія **2.117.2**.
- Файл: `dist/umd/supabase.js` з пакета (UMD-збірка, глобальна змінна `window.supabase`).
- Ліцензія: MIT (Supabase Inc.).
- Як оновити версію:
  ```bash
  cd v2/mvp/tests && npm install @supabase/supabase-js@<нова версія>
  cp node_modules/@supabase/supabase-js/dist/umd/supabase.js ../../build/assets/vendor/supabase-js.js
  ```
  Після оновлення — прогнати `node v2/mvp/tests/account-e2e.mjs`, оновити версію в цьому файлі.
