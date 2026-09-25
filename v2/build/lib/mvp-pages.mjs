// MVP-тренажер: сторінки-оболонки, які наповнює assets/trainer.js / assets/coach.js.
// Статичний вміст (одностраничник для керівника) збирається тут дослівно з уроків.
import { escapeHtml } from './md.mjs';

const PII_WARNING = 'Не вписуй імена, телефони й адреси клієнтів — лише текст репліки.';

function noJs(msg) {
  return `<noscript><p class="lesson-body">${escapeHtml(msg)}</p></noscript>`;
}

export function buildMvpPages({ shellPage, renderCover, trainer, accountsOn = false }) {
  const pages = [];
  const cover = (назва, підзаголовок) => renderCover({ назва, підзаголовок }, 'course', { eyebrow: 'Ikorka Shop · тренажер новачка' });

  // ---- Мій акаунт (публічний деплой, зріз 1) — лише коли Supabase налаштовано при збірці ----
  if (accountsOn) {
    pages.push({
      slug: 'account',
      html: shellPage({
        activeSlug: 'account', pageSlug: 'account', pageKind: 'account',
        title: 'Мій акаунт', description: 'Вхід, реєстрація і синхронізація прогресу з хмарою',
        heroHtml: cover('Мій акаунт', 'Увійди, щоб прогрес зберігався в хмарі і був видний керівнику.'),
        bodyHtml: `<div id="account-app" class="mvp-app"><p class="lesson-body">Завантаження…</p></div>${noJs('Вхід в акаунт працює з увімкненим JavaScript.')}`,
        prev: null, next: null,
      }),
    });
  }

  // ---- Симулятор сцен ----
  pages.push({
    slug: 'trenazher',
    html: shellPage({
      activeSlug: 'trenazher', pageSlug: 'trenazher', pageKind: 'trenazher',
      title: 'Симулятор дзвінка', description: 'Сцени з уроків: реплика клієнта, вибір відповіді, наслідок і розбір',
      heroHtml: cover('Симулятор дзвінка', 'Обери відповідь — і подивись, до чого вона веде. Помилка тут нічого не коштує.'),
      bodyHtml: `<div id="sim-app" class="mvp-app"><p class="lesson-body">Сцени завантажуються…</p></div>${noJs('Симулятор працює з увімкненим JavaScript.')}`,
      prev: null, next: null,
    }),
  });

  // ---- ІІ-тренер ----
  pages.push({
    slug: 'trener',
    html: shellPage({
      activeSlug: 'trener', pageSlug: 'trener', pageKind: 'trener',
      title: 'ІІ-тренер', description: 'Розмова з ІІ-клієнтом за запереченнями з таблиці компанії і розбір відповіді за правилами уроків',
      heroHtml: cover('ІІ-тренер', 'Розмова з ІІ-клієнтом за запереченнями з таблиці компанії і розбір твоєї відповіді за правилами уроків. Тренер радить лише фрази з уроків.'),
      bodyHtml: `<p class="mvp-pii" role="note"><b>Увага:</b> ${escapeHtml(PII_WARNING)}</p>
<div id="coach-app" class="mvp-app"><p class="lesson-body">Тренер завантажується…</p></div>${noJs('Тренер працює з увімкненим JavaScript.')}`,
      prev: null, next: null, extraScripts: ['assets/coach.js'],
    }),
  });

  // ---- Перевірка готовності ----
  pages.push({
    slug: 'perevirka',
    html: shellPage({
      activeSlug: 'perevirka', pageSlug: 'perevirka', pageKind: 'perevirka',
      title: 'Перевірка готовності', description: 'Питання з усіх 12 уроків упереміш, поріг і картка слабких тем',
      heroHtml: cover('Перевірка готовності', 'Питання з усіх дванадцяти уроків упереміш. Після — картка тем, які варто повторити.'),
      bodyHtml: `<div id="final-app" class="mvp-app"><p class="lesson-body">Перевірка завантажується…</p></div>${noJs('Перевірка працює з увімкненим JavaScript.')}`,
      prev: null, next: null,
    }),
  });

  // ---- Керівнику: одностраничник дослівно з уроків ----
  const lessonsHtml = trainer.lessons.map(l => {
    const rules = l.rules.length
      ? `<ul class="mgr-rules">${l.rules.map(r => `<li><b>Правило ${escapeHtml(r.code)}.</b> ${escapeHtml(r.text)}${r.label ? ` <span class="mvp-label">${escapeHtml(r.label)}</span>` : ''}</li>`).join('')}</ul>`
      : '<p class="lesson-body mvp-muted">Коди правил для цього уроку ще не розмічені.</p>';
    const practice = l.practice.length
      ? `<p class="mgr-sub">Що новачок робить на практиці (з уроку):</p><ol class="mgr-practice">${l.practice.map(p => `<li>${escapeHtml(p.text)}</li>`).join('')}</ol>`
      : '';
    return `<section class="mgr-lesson" aria-labelledby="mgr-u${l.n}"><h3 id="mgr-u${l.n}"><a href="${l.href}">Урок ${l.n}. ${escapeHtml(l.title)}</a> <small>День ${l.day}</small></h3>${rules}${practice}</section>`;
  }).join('');
  pages.push({
    slug: 'kerivnyku',
    html: shellPage({
      activeSlug: 'kerivnyku', pageSlug: 'kerivnyku', pageKind: 'kerivnyku',
      title: 'Керівнику: як супроводжувати новачка', description: 'Прогрес новачків і одностраничник з правилами уроків',
      heroHtml: cover('Керівнику', 'Прогрес новачків і короткий супровід за правилами уроків курсу.'),
      bodyHtml: `${accountsOn ? `<h2 id="novachky">Новачки (хмара)</h2>
<p class="lesson-body">Прогрес усіх запрошених новачків, синхронізований із хмарою: по днях і уроках, дата останньої активності, історія спроб тесту й тренажера, скидання прогресу (весь або по уроку). Видно лише керівнику.</p>
<div id="mentor-app" class="mvp-app"><p class="lesson-body">Завантаження…</p></div>` : ''}
<h2 id="eksport">Прогрес новачка (вручну, без акаунта)</h2>
<p class="lesson-body">Резервний спосіб — прогрес із самого браузера новачка. Попроси його відкрити цю сторінку на своєму пристрої і завантажити файл — або відкрий файл, який він тобі надіслав.</p>
<div id="manager-app" class="mvp-app"><p class="lesson-body">Завантаження…</p></div>
<h2 id="iak-suprovodzhuvaty">Як супроводжувати новачка</h2>
<p class="lesson-body">Курс — самонавчання: новачок сам розбирає свої дзвінки за правилами уроків. Нижче — правила кожного уроку і практичні завдання дослівно з уроків, щоб звіряти з ними дзвінки новачка.</p>
${lessonsHtml}`,
      prev: null, next: null,
    }),
  });

  return pages;
}

export { PII_WARNING };
