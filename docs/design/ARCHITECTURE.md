# DUO-редизайн — архитектура и контракты (ветка `design-duo`)

Источник правды для всей команды агентов. Меняет только Lead. Если контракт мешает — пиши Lead'у
в своём отчёте, не меняй чужие файлы.

## 0. Принципы

- Статический сайт, сборка `node v2/build/build.mjs` → `v2/site/` (Netlify publish). Никаких фреймворков,
  бандлеров и npm-зависимостей в рантайме. Классические `<script defer>` + общий неймспейс `window.Duo`.
- Новые страницы («Duo-слой») живут рядом со старыми. Старые страницы (уроки-теория `urok-NN.html`,
  дни `den-0N.html`, SOS, тренажёр, ІІ-тренер, повторення, перевірка, керівнику) остаются рабочими —
  это «Шпаргалка/теория» и существующие инструменты. Их тесты должны оставаться зелёными.
- Анимируем только `transform` и `opacity`. Никаких постоянных анимаций в покое (исключение —
  тултип «ПОЧАТИ» текущего узла, останавливается вне экрана). `prefers-reduced-motion` → мгновенные
  конечные состояния, звук и логика сохраняются.
- Бюджет: добавленный JS ≤ 80 KB gzip на странице урока; Lighthouse mobile Perf ≥ 90, A11y ≥ 95, CLS < 0.05.
- Язык интерфейса — украинский. Термины курса — по `v2/SPEC_v2.md` §2 (сет, заперечення, допродаж,
  наставник, Odoo…). Стоп-лист SPEC §7 действует и для Duo-текстов: никаких дробей вида `2/4`
  (пиши «2 з 4»), никаких эмодзи, «100 дзвінк…» (норма — 75 дзвінків).
- Никаких ассетов Duolingo (сова, иллюстрации, звуки, шрифты Feather/DIN Round, тексты). Всё своё.

## 1. Страницы (генерирует `v2/build/duo/build-duo.mjs`)

| Файл | Что | Владелец разметки/логики |
|---|---|---|
| `index.html` | Навчання: путь (юниты = дни), онбординг для нового пользователя (как контент страницы, НЕ диалог) | builder-home |
| `vprava.html?n=<nodeId>` | Плеер урока (полноэкранный, без навигации) | builder-lesson |
| `praktyka.html` | Практика: «Повторити помилки», SOS-тренування, ссылки на повторення/тренажер/ІІ-тренер | builder-celebrate |
| `zavdannia.html` | Щоденні завдання + сундук | builder-celebrate |
| `profil.html` | Профіль: статистика, досягнення, календар, налаштування (звук, вібрація, тема, ціль) | builder-celebrate |
| `shpargalka.html#den-N` | Шпаргалка юнита: правила уроков дня, фразы «Скажи так», ссылки на теорию/SOS | builder-home (P1) |
| `sogodni.html` | Старая «Сьогодні» (перенесена с index.html без изменений, ради экспорта/импорта прогресса) | — |

Каждая Duo-страница: `<html lang="uk">`, `<main id="main-content">`, `<title>`, тема из
`localStorage['ikorka-theme']` (`'dark'` → `data-theme="dark"` на `<html>`, иначе светлая), никаких
диалогов/поповеров при загрузке без действия пользователя (матрица тестов это проверяет:
`v2/mvp/tests/matrix.mjs`), нет горизонтального скролла на 375 и 1280 px, консоль чистая.

## 2. Файлы и владение

```
v2/build/duo/                 build-time (Node), владелец Lead
  build-duo.mjs               компиляция контента, data-файлы, генерация страниц
  shell.mjs                   duoShell(): <head>, шрифты, css/js, каркас навигации
  content.mjs                 загрузка + валидация v2/duo/content/*.json, карта курса
v2/duo/
  content/urok_01..12.json    упражнения уроков (content-adapter)
  content/course.json         раскладка пути: узлы, сундуки, боссы (Lead)
  SCHEMA.md                   схема упражнений (Lead)
  tools/validate-duo.mjs      CLI-валидатор (Lead)
  lab/*.html                  демо-стенды компонентов (кто делает компонент — тот и стенд), в сборку не входят
v2/build/assets/duo/          рантайм (браузер) → копируется в v2/site/assets/duo/
  fonts/                      Nunito (self-host, woff2 latin + cyrillic) — Lead
  tokens.css                  design-system-engineer
  core.css                    design-system-engineer: база, типографика, кнопки, карточки, варианты, бейджи, sheet/modal/toast
  core.js                     design-system-engineer: Duo.env, Duo.ui (sheet/modal/toast, focus-trap, Esc)
  motion.js                   motion-sound-designer: Duo.motion
  sfx.js                      motion-sound-designer: Duo.sfx, Duo.haptics
  mascot.js / mascot.css      mascot-illustrator: Duo.mascot (UMD — используется и при сборке)
  illos.js                    mascot-illustrator: Duo.illos (SVG-строки иллюстраций), UMD
  copy.js                     content-adapter: Duo.copy — ВСЯ микрокопия интерфейса
  progress-core.js            Lead: чистая логика прогресса (UMD, юнит-тесты в Node)
  progress.js                 Lead: хранилище, события, синхронизация с Supabase
  lesson.js / exercises.js / lesson.css        builder-lesson
  path.js / shell.js / home.css                builder-home
  celebrate.js / meta.js / meta.css            builder-celebrate
v2/site/data/                 (генерируется) duo-course.js, duo-u01..12.js — под гейтингом edge-функции
```

Данные упражнений кладём в `/data/`, а не в `/assets/`: `/assets/*` публичен без входа
(`netlify/edge-functions/lib/gate-logic.mjs`), `/data/*` — нет.

## 3. Порядок подключения скриптов (все `defer`, в этом порядке)

Все Duo-страницы: `data/duo-course.js`, `assets/duo/core.js`, `motion.js`, `sfx.js`, `progress-core.js`,
`progress.js`, `mascot.js`, `illos.js`, `copy.js`, `celebrate.js`, `shell.js` + страничные:
`index.html` → `path.js`; `vprava.html` → `exercises.js`, `lesson.js`; `praktyka/zavdannia/profil` → `meta.js`.
При включённых аккаунтах сборка добавляет `vendor/supabase-js.js`, `supabase-config.js`, `account.js`
(account.js на Duo-страницах работает без `window.MVP`: только сессия/кука `sb_at`/виджет; Duo-прогресс
синхронизирует `progress.js` через `window.ACCOUNT.sb`).

Каждый модуль — IIFE, регистрирует себя в `window.Duo` и НЕ падает, если соседнего модуля нет
(`Duo.sfx && Duo.sfx.play('x')`). Инициализация — на `DOMContentLoaded` (или сразу, если DOM готов).

## 4. Контракты API

### 4.1 `Duo.env` (core.js)
`Duo.env.reducedMotion` (bool, живой — через matchMedia), `Duo.env.touch` (bool),
`Duo.env.on(eventName, fn)` / `Duo.env.emit(eventName, detail)` — простая шина событий
(события прогресса идут через неё, см. 4.5).

### 4.2 `Duo.ui` (core.js)
- `Duo.ui.sheet({ tone: 'neutral'|'success'|'error', html, actions: [{label, kind: 'primary'|'secondary'|'ghost', onClick}], dismissible, onClose }) → { el, close() }` — нижний лист, выезжает `Duo.motion.sheetUp`.
- `Duo.ui.modal({ html, actions, dismissible }) → { el, close() }` — центр/полноэкранный на мобиле; focus-trap, Esc (если dismissible), возврат фокуса.
- `Duo.ui.toast(text, { tone, ms })`.
- `Duo.ui.button(label, { kind, size, icon }) → HTMLButtonElement` — 3D-кнопка (классы ниже).

### 4.3 `Duo.motion` (motion.js)
Все функции возвращают `Promise` (резолв по окончании), при reduced motion — мгновенно ставят конечное состояние.
`popIn(el)`, `pressDown(el)`, `shake(el)`, `bounceTooltip(el) → {stop()}` (сам паузится вне экрана через IntersectionObserver),
`springGrow(fillEl, fromFrac, toFrac)` (прогресс-бар: `transform: scaleX`, лёгкий перелёт),
`countUp(el, from, to, { ms, onTick })`, `flip(els, mutate)` (FLIP: замер → mutate() → анимация),
`flyTo(el, targetEl, { ms })`, `sheetUp(el)`, `sheetDown(el)`, `heartBreak(heartEl)`,
`floatText(anchorEl, text, { tone })` («+10 XP», «−1»), `confetti({ ms = 1400, origin })` (canvas создаётся и удаляется сам),
`fadeIn(el)`, `fadeOut(el)`, `stagger(els, fn, stepMs)`.
Константы: `Duo.motion.dur = { instant, fast, base, slow, celebrate }`, `Duo.motion.ease = { out, inOut, spring, bounce }` — зеркало CSS-токенов.

### 4.4 `Duo.sfx` / `Duo.haptics` (sfx.js)
`Duo.sfx.play(name)` — синтез Web Audio (никаких чужих файлов). Имена (≥ 12, одна тональность):
`tap`, `tileSelect`, `tileReturn`, `correct`, `wrong`, `combo`, `heartLose`, `lessonComplete`,
`xpTick`, `streak`, `chest`, `goal`, `unlock`, `matchPair`, `sheet`, `click`.
`Duo.sfx.enabled` (get/set, хранится в `localStorage['ikorka-duo-sound']` = `'on'|'off'`, по умолчанию on),
`Duo.sfx.volume` (0..1, по умолчанию 0.5). AudioContext создаётся на первом жесте пользователя.
`Duo.haptics.play('correct'|'wrong'|'celebrate'|'tap')` — `navigator.vibrate`, выключается вместе со звуком.

### 4.5 `Duo.progress` (progress.js, логика в progress-core.js)
Хранилище `localStorage['ikorka-duo']` (офлайн-первично). Даты — локальная дата Europe/Kyiv (`YYYY-MM-DD`).
- `get()` → снимок состояния (не мутировать).
- `today()` → ключ дня (Kyiv).
- `nodeState(nodeId)` → `'locked'|'available'|'current'|'done'`; `currentNodeId()`.
- `completeNode(nodeId, { correct, total, mistakes, ms, perfect })` → `{ xp, xpBreakdown, accuracy, firstToday, streak: {before, after}, goal: {before, after, target, reachedNow}, quests: [completed…], achievements: [unlocked…], nextNodeId }`.
- `openChest(chestId)` → `{ xp }`. `xpToday()`, `xpTotal()`.
- `streak()` → `{ count, activeToday, week: [{ day, active }]×7, frozen }`.
- `dailyGoal()` → `{ target, xpToday, done }`; `setDailyGoal(xp)`.
- `hearts()` → `{ n, max: 5 }`; `loseHeart()`; `refillHearts()`.
- `recordMistake({ lesson, stepId, nodeId })`, `mistakes()` → список, `resolveMistake(stepId)`.
- `quests()` → `[{ id, title, target, value, done }]×3` на сегодня; `questChest()` → `{ ready, opened }`; `openQuestChest()`.
- `achievements()` → `[{ id, level, maxLevel, value, next }]`.
- `settings()` / `setSetting(key, value)` (`goal`, `sound`, `haptics`), `onboarded()` / `setOnboarded()`.
- События через `Duo.env.on`: `progress:change`, `progress:xp`, `progress:streak`, `progress:goal`, `progress:quest`, `progress:achievement`.
Синхронизация: если есть `window.ACCOUNT.sb` и сессия — таблица `duo_progress` (миграция `0004`), слияние
`DuoProgressCore.merge(local, remote)` (события XP — объединение по id, при конфликте побеждает сервер).

### 4.6 `Duo.celebrate` (celebrate.js)
Очередь празднований — никогда два попапа одновременно, порядок предсказуем.
`Duo.celebrate.enqueue({ type, data })`, `Duo.celebrate.run() → Promise` (резолв, когда очередь пуста).
Типы и порядок после урока: `lessonComplete` → `streak` (если день засчитан впервые) → `goal` (если цель
выполнена сейчас) → `quest` (выполненные задания) → `achievement`. Экраны полноэкранные, с маскотом,
звуком (`Duo.sfx`), вибрацией, confetti ≤ 1.5 с.

### 4.7 `Duo.mascot` (mascot.js, UMD)
- `Duo.mascot.svg(emotion, { size, title })` → строка SVG (работает и в Node при сборке: `require`/`import` не нужен DOM).
- `Duo.mascot.mount(el, { emotion, size, idle })` → `{ set(emotion), play(action), destroy() }`; `idle` = моргание раз в 3–6 с (только пока виден на экране).
- `Duo.mascot.peek({ side: 'left'|'right', text, emotion, ms })` — выглядывает сбоку с репликой (комбо в уроке).
- Эмоции: `idle`, `happy`, `excited`, `sad`, `thinking`, `cheer`, `coach` (серьёзный тренер для ИІ-босса), `sleepy`.
- Действия: `blink`, `wave`, `jump`, `nod`.

### 4.8 `Duo.copy` (copy.js)
Вся микрокопия. Функции там, где нужна вариативность:
`praise()` (ротация ≥ 15 фраз, без повтора подряд), `wrongTitle()`, `accuracyEpithet(pct)`,
`comboBadge(n)` («5 поспіль!»), `mascotLine(key)`, `streakText(n)`, объекты `exitSheet`, `heartsEmpty`,
`lessonComplete`, `goal`, `quests`, `onboarding`, `nav`, `buttons` (`check`, `next`, `gotIt`, `start`, `repeat`, `claimXp`…).

## 5. Классы и токены (для всех билдеров)

Токены — CSS custom properties в `tokens.css` (владелец design-system-engineer), светлая и тёмная тема
(`:root[data-theme="dark"]`). Никаких магических чисел в компонентах: цвета, радиусы, тени, отступы
(шкала 4/8), размеры шрифта, длительности, easing — только через `var(--…)`.
Семантика: `--c-success` (зелёный), `--c-error` (красный), `--c-info` (синий), `--c-streak` (оранжевый),
`--c-xp` (золотой), `--c-brand` (икорный тёплый красный/янтарь), нейтральные `--c-line`, `--c-muted`…;
у каждого цвета «тёмная тень» `--c-*-shadow` для 3D. Кнопки: `.d-btn` + `.d-btn--primary|secondary|success|danger|ghost`
+ `.d-btn--lg|md|sm`; состояния default/hover/pressed/disabled/focus-visible/loading (`.is-loading`).
Карточки-варианты: `.d-option` (+ `.is-selected`, `.is-correct`, `.is-wrong`, `.is-disabled`), подсказка
цифры `.d-option__key`. Точный перечень — в `docs/design/DESIGN_SYSTEM.md` (пишет design-system-engineer).

## 6. Данные курса

`data/duo-course.js` → `window.DUO_COURSE`:
```js
{ v: 1, units: [ { n: 1, day: 1, title: 'День 1', topic: 'Вступ · Гачок · Етапи дзвінка', color: 1,
    cheat: 'shpargalka.html#den-1', lessons: [1, 2, 3],
    items: [ { kind: 'node', id: 'u01-1', lesson: 1, idx: 1, of: 2, title: '…', steps: 12 },
             { kind: 'chest', id: 'c1', after: 'u02-1' },
             { kind: 'boss', id: 'b1', title: '…', persona: 'dz-13' } ] } ],
  lessons: { '1': { title: 'Вступ', href: 'urok-01.html', nodes: ['u01-1', 'u01-2'] } } }
```
`data/duo-uNN.js` → `(window.DUO_LESSONS = window.DUO_LESSONS || {})[N] = { lesson, nodes: [...] }` —
формат узлов и шагов: `v2/duo/SCHEMA.md`.
