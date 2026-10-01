/* Ikorka Duo — мікрокопія інтерфейсу: window.Duo.copy (UMD: браузер + Node для збірки сторінок).
 * Контракт — docs/design/ARCHITECTURE.md §4.8. Єдине джерело текстів Duo-шару українською.
 * Схема назв: День → Урок (теорія, 12) → Частина (вузол шляху, 24) → Крок. «Урок» — лише теорія.
 * Функції там, де потрібна варіативність або відмінки; решта — об'єкти за екранами.
 * Модуль без залежностей і без DOM: його читають lesson/celebrate/meta/shell/path/signals. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') { var D = window.Duo = window.Duo || {}; D.copy = api; }
})(this, function () {
  'use strict';

  function plural(n, one, few, many) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    return b > 1 && b < 5 ? few : many;
  }
  function days(n) { return plural(n, 'день', 'дні', 'днів'); }

  // ротація без повтору підряд
  function rotator(list) {
    var last = -1;
    return function () {
      if (list.length < 2) return list[0];
      var i; do { i = Math.floor(Math.random() * list.length); } while (i === last);
      last = i; return list[i];
    };
  }

  var PRAISE = [
    'Чудово!', 'Так тримати!', 'Влучно!', 'Ти в темі!', 'Саме так!', 'Точно!', 'Гарна робота!', 'Впевнено!',
    'У точку!', 'Чітко!', 'Молодець!', 'Сильний хід!', 'Без вагань!', 'Ось це рівень!', 'Так і роби!', 'Тримаєш темп!'
  ];
  var WRONG = ['Не зовсім', 'Майже', 'Тут була пастка', 'Варто запам\'ятати', 'Ще не те'];
  var LEVEL_NEXT = 'до наступного рівня';

  var QUESTS = {
    perfect: 'Пройди частину без помилок',
    xp30: 'Набери 30 XP',
    coach: 'Пройди бос-випробування',
    coachOffline: 'Відпрацюй 3 заперечення'
  };
  var ACH = {
    objections: { name: 'Майстер заперечень', what: 'Відпрацьовані заперечення' },
    streak:     { name: 'Вогняна серія',      what: 'Найдовша серія, днів' },
    perfect:    { name: 'Без жодної помилки', what: 'Частини без помилок' },
    builder:    { name: 'Знавець скрипта',    what: 'Зібрані фрази скрипта' },
    boss:       { name: 'Легенда дзвінка',    what: 'Пройдені босі' },
    course:     { name: 'Крок за кроком',     what: 'Повністю пройдені уроки' }
  };

  var C = {
    plural: plural,
    days: days,
    praise: rotator(PRAISE),
    wrongTitle: rotator(WRONG),
    comboBadge: function (n) { return n + ' поспіль!'; },
    accuracyEpithet: function (pct) {
      return pct >= 100 ? 'Ідеально!' : pct >= 90 ? 'Чудово!' : pct >= 75 ? 'Добре!' : pct >= 50 ? 'Непогано, є що підтягнути' : 'Повтор — найкращий друг пам\'яті';
    },
    streakText: function (n) { return 'Серія: ' + n + ' ' + days(n); },
    level: function (lv, max) { return 'Рівень ' + lv + ' з ' + max; },
    levelNext: LEVEL_NEXT,
    quest: function (id) { return QUESTS[id] || 'Щоденне завдання'; },
    achievement: function (id) { return ACH[id] || { name: 'Досягнення', what: 'Прогрес' }; },

    // календар і позначки днів (для читалки)
    weekdays: ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'],
    weekdaysFull: ['понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота', 'неділя'],
    months: ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'],
    monthsGen: ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'],
    thisWeek: 'Цей тиждень',
    dayMark: { done: ', зараховано', future: ', ще попереду', none: ', без занять', today: ', сьогодні' },

    // плеєр (lesson.js, exercises.js через Duo.exercises.labels)
    lesson: {
      correctAnswer: 'Правильна відповідь:',
      buttons: { check: 'Перевірити', next: 'Далі', gotIt: 'Зрозуміло', cont: 'Продовжити', toLearn: 'До навчання', stay: 'Продовжити', leave: 'Вийти', refill: 'Поповнити', close: 'Вийти' },
      exit: { title: 'Точно вийти?', text: 'Прогрес не збережеться.' },
      heartsEmpty: { title: 'Серця закінчилися', text: 'Поповни серця, щоб продовжити. Або повернись до навчання й повтори помилки.' },
      errors: {
        load: 'Не вдалося завантажити частину. Перевір з\'єднання й спробуй ще раз.',
        missing: 'Такої частини немає. Повернись до навчання й обери іншу.',
        noMistakes: 'Помилок для повторення немає. Так тримати!'
      },
      done: {
        title: 'Частину пройдено!', titlePractice: 'Повторення завершено!', xp: 'XP', accuracy: 'Точність', streak: 'Серія', time: 'Час', mistakes: 'Помилок',
        min: 'хв', sec: 'с',
        xpKinds: { lesson: 'Частина', repeat: 'Повтор частини', perfect: 'Без помилок', practice: 'Практика', practicePerfect: 'Без помилок', boss: 'Бос', bossPerfect: 'Без помилок' }
      },
      mistakesMode: { title: 'Повторення помилок' },
      sos: { title: 'Швидке повторення', done: 'Готово!', sub: 'Ключові правила повторено', cards: 'Карток', answers: 'Відповідей', note: 'Це швидке повторення: без сердець і XP.' },
      chest: { locked: 'Скриня відкриється після частини «{t}». Спершу пройди її.', opened: 'Скриню відкрито!', already: 'Цю скриню вже відкрито', sub: 'Нагорода за пройдені частини', nodes: 'Частин пройдено', reward: 'Нагорода', take: 'Забрати', alreadyText: 'XP за неї вже зараховано.' },
      boss: { titleDone: 'Боса пройдено!', retry: 'Ще раз!', retryText: 'Потрібно щонайменше {n} з {t} правильних з першої спроби. Повтори правила й спробуй знову.', again: 'Спробувати ще раз', got: 'Правильно з першої' },
      settings: { label: 'Налаштування сигналів', title: 'Сигнали', done: 'Готово' },
      aria: { progress: 'Прогрес частини', heartsOf: 'Серця', of: 'з', right: 'Правильно.', wrong: 'Неправильно.', stage: 'Вміст кроку' },
      ex: {
        clientSays: 'Клієнт каже', manager: 'Менеджер', client: 'Клієнт', example: 'Приклад фрази',
        theoryTitle: 'Запам\'ятай', pChoice: 'Обери найкращу відповідь', pTruefalse: 'Правда чи міф?', pBuild: 'Склади фразу',
        pMatch: 'Поєднай пари', pOrder: 'Розстав по порядку', pFill: 'Встав пропущене', pSpot: 'Знайди помилку менеджера',
        'true': 'Правда', 'false': 'Міф', trueFull: 'Правда', falseFull: 'Міф — твердження хибне', blank: 'Пропуск',
        spotAnswer: 'Помилка тут:', yourAnswer: 'Твоя відповідь', wordBank: 'Доступні слова', tapWords: 'Торкайся слів нижче, щоб скласти фразу',
        yourOrder: 'Твій порядок', stepsBank: 'Кроки для розстановки', tapSteps: 'Торкайся кроків у правильному порядку', rightOrder: 'Правильний порядок:',
        matchLeft: 'Ліва колонка', matchRight: 'Права колонка', pair: 'пара', rightPairs: 'Правильні пари:', matchTries: 'Помилкових спроб: {n}. Ще один підхід — і пари закріпляться.'
      }
    },

    // екрани святкування (celebrate.js)
    celebrate: {
      cont: 'Продовжити',
      streakFirst: 'Перший день є. Повертайся завтра й продовжуй!',
      streakMore: 'Ти займаєшся щодня. Так тримати!',
      goalTitle: 'Ціль дня виконано!',
      goalSub: function (xp, target) { return 'Сьогодні ' + xp + ' XP. Ціль була ' + target + ' XP.'; },
      ofXp: function (target) { return 'з ' + target + ' XP'; },
      questOne: 'Завдання виконано!', questMany: 'Завдання виконано',
      questSubOne: 'Так тримати. Скриня з XP чекає у вкладці «Завдання».',
      questSubMany: 'Зазирни у вкладку «Завдання» по скриню.',
      achTitle: 'Нове досягнення!',
      achNext: function (what, value, next) { return what + ': ' + value + ' з ' + next + ' ' + LEVEL_NEXT + '.'; },
      achTop: 'Найвищий рівень відкрито.',
      partTitle: 'Частину пройдено!', partSub: 'Гарна робота!', accuracy: 'Точність', xp: 'XP'
    },

    // мета-сторінки: Практика, Завдання, Профіль (meta.js)
    meta: {
      mistakesSome: function (n) { return 'Є ' + n + ' ' + plural(n, 'помилка', 'помилки', 'помилок') + ' для повторення. Повтори їх, щоб закріпити правила.'; },
      mistakesNone: 'Помилок для повторення зараз немає. Коли помилишся в частині, завдання з’явиться тут.',
      repeatMistakes: 'Повторити помилки',
      toLearn: 'До навчання',
      ofXp: function (target) { return 'з ' + target + ' XP'; },
      goalDone: 'Ціль виконано',
      goalLeft: function (n) { return 'Ще ' + n + ' XP'; },
      goalBar: 'Ціль дня, XP',
      goalOver: function (n) { return 'Сьогодні набрано ' + n + ' XP, це більше за ціль.'; },
      done: 'Виконано',
      of: function (v, t) { return v + ' з ' + t; },
      chestOpened: 'Скриню відкрито. Нова скриня чекатиме завтра.',
      opened: 'Відкрито',
      chestReady: 'Усі завдання виконано. Скриня готова до відкриття.',
      open: 'Відкрити',
      chestClosed: function (left) { return 'Скриня зачинена. Виконай ще ' + left + ' ' + plural(left, 'завдання', 'завдання', 'завдань') + ', щоб відкрити її та отримати XP.'; },
      closed: 'Зачинена',
      chestLive: function (xp) { return 'Скриню відкрито: +' + xp + ' XP'; },
      monthActive: function (n) { return 'У цьому місяці занять: ' + n + ' ' + days(n) + '. Підсвічені дні зараховані.'; },
      monthNone: 'У цьому місяці занять поки немає. Пройди частину, і день підсвітиться.',
      kpiStreak: 'Серія', kpiXpTotal: 'XP всього', kpiXpToday: 'XP сьогодні', kpiParts: 'Пройдено частин',
      notYet: 'Ще не відкрито',
      achProgress: function (what, v, next) { return what + ': ' + v + ' з ' + next; },
      achTop: function (what, v) { return what + ': ' + v + '. Найвищий рівень!'; },
      achBar: function (name) { return name + ': ' + LEVEL_NEXT; }
    },

    // верхня панель (shell.js)
    topbar: {
      daysShort: 'дн.',
      streakSr: function (n, today) { return C.streakText(n) + (today ? ', сьогодні зараховано' : ''); },
      heartsSr: function (n, max) { return 'Серця: ' + n + ' з ' + max; },
      ofXp: function (target) { return ' з ' + target + ' XP'; },
      goalDone: 'Ціль виконано',
      xpSrDone: function (t) { return 'Ціль виконано: ' + t + ' XP з ' + t + ' XP на сьогодні'; },
      xpSr: function (xp, t) { return 'Сьогодні ' + xp + ' XP з цілі ' + t + ' XP'; }
    },

    // шлях на головній (path.js)
    path: {
      state: { locked: 'закрито', available: 'доступно', current: 'поточна', done: 'пройдено' },
      chest: { locked: 'закрита', available: 'готова, можна відкрити', done: 'відкрита' },
      boss: { locked: 'недоступний', available: 'доступний', done: 'пройдено' },
      start: 'Почати',
      lockedPart: 'Спершу заверши попередню частину',
      lockedBoss: 'Спершу заверши всі частини цього дня'
    },

    // перемикачі сигналів (signals.js)
    signals: {
      sound: 'Звук', soundHint: 'Короткі тони під час занять',
      haptics: 'Вібрація', hapticsHint: 'Короткий відгук на телефоні',
      hapticsReduced: 'Вимкнена, бо в системі увімкнено «зменшити рух»'
    }
  };
  return C;
});
