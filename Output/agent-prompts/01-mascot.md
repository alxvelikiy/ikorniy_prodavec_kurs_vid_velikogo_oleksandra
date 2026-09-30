# 01-mascot: модуль маскота Duo-слоя

**Цель.** Создать `v2/build/assets/duo/mascot.js` и `mascot.css`: лёгкий SVG/CSS-маскот «ікринка» с эмоциями и реакциями на события плеера. Контракт API: `docs/design/ARCHITECTURE.md` §4.7 (`Duo.mascot.svg`, `mount`, `peek`; эмоции idle, happy, excited, sad, thinking, cheer, coach, sleepy; действия blink, wave, jump, nod). Модуль UMD (работает и в Node при сборке для `svg()`).

**Входные файлы (читай точечно, grep/диапазоны строк).**
- `docs/design/ARCHITECTURE.md` §0, §4.7, §5 (токены, никаких хардкод-цветов)
- `v2/build/assets/duo/tokens.css`, `motion.js` (Duo.motion), `core.js` (Duo.env)
- `docs/design/DUO_TEARDOWN.md`: только места про маскота
- Событие сигналов: `Duo.env.emit('signal', { name })`, где name: correct, wrong, heart_lost, streak, node_complete, lesson_complete, tap_tile. Маскот подписывается через `Duo.env.on('signal', fn)` и сам решает реакцию (correct → happy+nod, wrong → sad, streak → excited+jump, lesson_complete → cheer). Не показывай реакцию чаще раза в 2 с.

**Критерий готовности.**
1. `Duo.mascot.svg(emotion, {size, title})` для всех 8 эмоций; `mount()` и `peek()` работают; `destroy()` снимает подписки и таймеры.
2. Никаких ассетов Duolingo и внешних файлов. Вес mascot.js + mascot.css ≤ 12 KB gzip.
3. Анимации только transform/opacity; при reduced motion только смена эмоции без движения; моргание паузится вне экрана (IntersectionObserver).
4. Контраст и читаемость в светлой и тёмной теме; у SVG `role="img"` и осмысленный `<title>` на украинском или `aria-hidden` для декора.
5. Стенд `v2/duo/lab/mascot.html` (8 эмоций × 2 темы) и один скриншот стенда `v2/duo/lab/mascot-shot.png`.
6. Проверка: страница урока `vprava.html?n=u01-1` (сборка: `node v2/duo/tools/dev-shot.mjs ...`, см. шапку файла) подхватывает маскот без ошибок консоли. Файлы плеера (`lesson.js`, `lesson.css`, `exercises.js`) не правь.

**Ограничения.** Точечные правки, файлы целиком не перечитывай. Git не используй. В Bash без обратных кавычек. Скриншот один, на контрольной точке. Отчёт ≤ 15 строк: что сделано, вес, что не проверено.
