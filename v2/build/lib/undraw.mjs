// Ілюстрації розділів з готових бібліотек (рішення замовника 2026-09-23: ручне SVG-малювання не тягне рівень DOU).
// unDraw (undraw.co — безкоштовно, без атрибуції; ліцензія забороняє роздавати файли окремо,
// тому SVG лише вбудовуються в сторінку, в site/assets не копіюються) + значки Lucide (ISC).
// Перефарбування: акцент unDraw #6c63ff → --brand (той самий колір, що донат); нейтральні — токени --illo-*,
// щоб фігури лишались видимими в темній темі; тон шкіри не змінюється.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'illos');
const RECOLOR = [
  [/#6c63ff/gi, 'var(--brand)'],
  [/#(090814|2f2e41|2f2e43|3f3d56|54576b|323144|535461|555758|707070|010102|010001|000000|000)\b/gi, 'var(--illo-dark)'],
  [/#(ff6584|ff6363)\b/gi, 'var(--brand)'],
  [/#(ccc|cccccc|cacaca|d6d6e3|e6e6e6|e5e5e5|e4e6ed|e1e7ef|dfe6f5)\b/gi, 'var(--illo-mid)'],
  [/#(f2f2f2|f0f0f0)\b/gi, 'var(--illo-light)'],
  [/#(fff|ffffff)\b/gi, 'var(--paper)'],
];

function undraw(file) {
  let s = fs.readFileSync(path.join(DIR, file), 'utf8');
  s = s.replace(/<\?xml[^>]*\?>\s*/, '').replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<svg\b([^>]*)>/, (m, attrs) => `<svg${attrs.replace(/\s(width|height)="[^"]*"/g, '')} class="undraw" aria-hidden="true" focusable="false">`);
  for (const [re, to] of RECOLOR) s = s.replace(re, to);
  return s;
}

const ICONS = {};
export function icon(name) {
  if (!(name in ICONS)) {
    const p = path.join(DIR, `lucide-${name}.svg`);
    ICONS[name] = fs.existsSync(p)
      ? fs.readFileSync(p, 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace(/\sclass="[^"]*"/, ' class="sec-ico-svg" aria-hidden="true"').replace(/\s(width|height)="24"/g, '').replace(/\s+/g, ' ').trim()
      : '';
  }
  return ICONS[name];
}

// Урок 1 — зразок. Підписи описують сцену, фактів не додають.
// Усі 5 — з однієї серії нового стилю unDraw (великі персонажі, палітра #090814/#ed9da0). Перевірено 2026-09-23:
// попередні audio-conversation / document-warning / recording були з інших серій стилю — замінено.
export const SECTION_ILLOS = {
  'urok-01': {
    'Що це': { file: 'talking-on-the-phone_lc9v.svg', caption: 'Дзвінок постійному клієнту: перші секунди вирішують, чи тебе дослухають' },
    'Чому це працює': { file: 'decide_g91m.svg', caption: 'Клієнт вирішує раніше, ніж встигає розібрати аргументи' },
    'Як це звучить у житті': { file: 'public-speaking_m17t.svg', caption: 'Одна впевнена фраза без пауз: хто дзвонить, звідки і чому' },
    'Типові помилки': { file: 'reading-notes_dg9z.svg', caption: 'Читання з аркуша видає шаблон' },
    'Практика': { file: 'voice-notes_x4kp.svg', caption: "Самозапис: п'ять дублів вступу підряд" },
  },
  'urok-02': {
    'Що це': { file: 'gifts_4gy3.svg', caption: "Привід дзвінка — те, що цікаво саме цьому клієнту" },
    'Чому це працює': { file: 'key-insights_ex8y.svg', caption: "Гачок працює, коли клієнт чує причину, а не рекламу" },
    'Як це звучить у житті': { file: 'respond_o54z.svg', caption: "Клієнт відповідає, бо почув свою причину" },
    'Типові помилки': { file: 'blocked_ldel.svg', caption: "Без приводу розмова обривається на першій фразі" },
    'Практика': { file: 'taking-notes_oyqz.svg', caption: "Запиши свої гачки й перевір їх на сьогоднішніх дзвінках" },
  },
  'urok-03': {
    'Що це': { file: 'mind-map_i9bv.svg', caption: "Один скелет розмови від вступу до прощання" },
    'Чому це працює': { file: 'to-do-list_eoia.svg', caption: "Кожен етап іде за своїм — без повернень назад" },
    'Як це звучить у житті': { file: 'business-pitch_h9yw.svg', caption: "Презентація веде до ціни, а ціна — до доставки" },
    'Типові помилки': { file: 'distractions_jmxk.svg', caption: "Пропущений етап збиває розмову з курсу" },
    'Практика': { file: 'schedule-cleanup_1xs7.svg', caption: "Розклади свій дзвінок по етапах перед наступним набором" },
  },
  'urok-04': {
    'Що це': { file: 'problem-solving_1kpx.svg', caption: "Заперечення — питання, на яке є відповідь" },
    'Чому це працює': { file: 'thought-process_ze2r.svg', caption: "Спершу зрозумій, яке це заперечення" },
    'Як це звучить у житті': { file: 'ask-online_8zdn.svg', caption: "Коротка відповідь по суті — і знову до пропозиції" },
    'Типові помилки': { file: 'negative-review_6l58.svg', caption: "Суперечка з клієнтом закриває розмову" },
    'Практика': { file: 'fill-the-blank_n29z.svg', caption: "Допиши свою відповідь на кожен тип заперечення" },
  },
  'urok-05': {
    'Що це': { file: 'thumbs-up_f300.svg', caption: "Заклик до дії звучить як твердження" },
    'Чому це працює': { file: 'next-task_jtbr.svg', caption: "Клієнту легше погодитись, коли наступний крок уже названо" },
    'Як це звучить у житті': { file: 'sign-here_lxua.svg', caption: "«Давайте оформимо» — і клієнт підтверджує" },
    'Типові помилки': { file: 'forgot-password_nttj.svg', caption: "Питання замість заклику дає привід відмовитись" },
    'Практика': { file: 'focused_m9bj.svg', caption: "Порахуй свої заклики в сьогоднішніх дзвінках" },
  },
  'urok-06': {
    'Що це': { file: 'personal-information_h7kf.svg', caption: "Ти бачиш історію клієнта — використай її" },
    'Чому це працює': { file: 'welcome-aboard_y4e9.svg', caption: "Ім'я і минулі замовлення роблять дзвінок особистим" },
    'Як це звучить у житті': { file: 'sentiment-analysis_rke9.svg', caption: "Клієнт чує, що його пам'ятають" },
    'Типові помилки': { file: 'no-signal_nqfa.svg', caption: "Картку переглянуто, а в розмову вона не потрапила" },
    'Практика': { file: 'blogging_38kl.svg', caption: "Випиши з картки одну деталь для кожного дзвінка" },
  },
  'urok-07': {
    'Що це': { file: 'product-demo_9d4i.svg', caption: "Пропозиція, яку клієнт уявляє, а не просто чує" },
    'Чому це працює': { file: 'capture-the-moment_ekcd.svg', caption: "Вигода — картина результату, а не перелік" },
    'Як це звучить у житті': { file: 'visual-explanation_vd4l.svg', caption: "Увесь пакет — однією фразою" },
    'Типові помилки': { file: 'multitasking_i2bv.svg', caption: "Пропозиція, що змінюється на ходу, губить клієнта" },
    'Практика': { file: 'essay-writing_nlru.svg', caption: "Склади свою фразу-пропозицію і промов її вголос" },
  },
  'urok-08': {
    'Що це': { file: 'choose_5kz4.svg', caption: "Спершу великий сет, менший — лише після повторного «дорого»" },
    'Чому це працює': { file: 'budget-adjustments_7fj9.svg', caption: "Спуск — це інший обсяг, а не знижка на те саме" },
    'Як це звучить у житті': { file: 'discount_igfl.svg', caption: "Альтернатива звучить з аргументом" },
    'Типові помилки': { file: 'savings_d97f.svg', caption: "Ранній спуск здешевлює всю розмову" },
    'Практика': { file: 'budgeting_klon.svg', caption: "Розпиши свою драбину сетів від більшого до меншого" },
  },
  'urok-09': {
    'Що це': { file: 'meditation_k4oa.svg', caption: "Спокійний голос звучить упевнено" },
    'Чому це працює': { file: 'mindfulness_d853.svg', caption: "Клієнт чує стан раніше, ніж слова" },
    'Як це звучить у житті': { file: 'remote-worker_0l91.svg', caption: "Рівний темп і пауза після заперечення" },
    'Типові помилки': { file: 'tight-deadline_u4hu.svg', caption: "Поспіх у голосі чути одразу" },
    'Практика': { file: 'listening-to-podcasts_j0hm.svg', caption: "Послухай свій запис так, як його чує клієнт" },
  },
  'urok-10': {
    'Що це': { file: 'book-writer_ri5u.svg', caption: "Кожне слово в дзвінку щось означає" },
    'Чому це працює': { file: 'reading_6jjr.svg', caption: "Зайві слова забирають час і впевненість" },
    'Як це звучить у житті': { file: 'working-at-home_pxaa.svg', caption: "Твердження замість «можемо»" },
    'Типові помилки': { file: 'grading-papers_7fpu.svg', caption: "Помічай свої слова-паразити на записі" },
    'Практика': { file: 'learning-to-sketch_uaxi.svg', caption: "Перепиши репліку без зайвих слів і промов її ще раз" },
  },
  'urok-11': {
    'Що це': { file: 'continuous-learning_a1ld.svg', caption: "Знання продукту — основа впевненої відповіді" },
    'Чому це працює': { file: 'homework-research_kufa.svg', caption: "Точна відповідь звучить переконливіше за приблизну" },
    'Як це звучить у житті': { file: 'in-the-office_e7pg.svg', caption: "Склад і ціна сету — напам'ять" },
    'Типові помилки': { file: 'exam-prep_nmly.svg', caption: "Пауза на питання про склад видає невпевненість" },
    'Практика': { file: 'reading-a-book_4cap.svg', caption: "Вивчи сети так, щоб відповідати без підглядання" },
  },
  'urok-12': {
    'Що це': { file: 'winner_x40e.svg', caption: "Замовлення оформлене — залишилось завершити дзвінок" },
    'Чому це працює': { file: 'all-checked_d3u6.svg', caption: "Підсумок одною фразою: склад, сума, відділення, оплата, термін" },
    'Як це звучить у житті': { file: 'holding-flowers_jc03.svg', caption: "Подяка і пряма лінія до тебе наостанок" },
    'Типові помилки': { file: 'deep-work_muov.svg', caption: "Затягнуте прощання забирає час наступних дзвінків" },
    'Практика': { file: 'certification_oqiz.svg', caption: "Склади свою фразу підсумку й доведи її до автоматизму" },
  },
};
// Маленькі значки при заголовках розділів (рішення замовника 2026-09-23, скасовує заборону в DESIGN_SYSTEM).
export const SECTION_ICONS = {
  'Що це': 'phone-call', 'Чому це працює': 'timer', 'Як це звучить у житті': 'audio-lines',
  'Типові помилки': 'circle-alert', 'Практика': 'mic', 'Перевір себе': 'list-checks', 'Чого ми поки не знаємо': 'circle-help',
  'Прийом на межі': 'scale', 'Допродаж одразу після згоди': 'circle-plus',
};

const cache = {};
export function sectionIllo(slug, heading) {
  const e = (SECTION_ILLOS[slug] || {})[heading];
  if (!e) return null;
  const key = slug + '|' + heading;
  return cache[key] || (cache[key] = { svg: undraw(e.file), caption: e.caption });
}
