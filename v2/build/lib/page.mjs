import { slugify, inlineRender, escapeHtml, renderListItem, splitReveal } from './md.mjs';
import { sectionIllo, icon, SECTION_ICONS } from './illos-loader.mjs';
import { renderCover, renderScene, renderStatGroup, renderCards, renderQuote, renderVideo, renderExtVideo, renderSay, renderInsight, renderQuiz, renderPullQuote, renderPairs } from './directives.mjs';

function renderTable(block) {
  const thead = `<tr>${block.header.map(h => `<th>${inlineRender(h)}</th>`).join('')}</tr>`;
  const tbody = block.rows.map(r => `<tr>${r.map(c => `<td>${inlineRender(c)}</td>`).join('')}</tr>`).join('');
  return `<div class="table-scroll"><table class="data-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>`;
}

function renderList(block, ctx) {
  const allCheckbox = block.items.length > 0 && block.items.every(raw => /^\[( |x|X)\]/.test(raw));
  if (allCheckbox) {
    const lis = block.items.map(raw => {
      const item = renderListItem(raw, ctx);
      const id = `${ctx.pageSlug}-cb-${ctx.checklistCounter.n++}`;
      return `<li class="check-item" data-check-id="${id}"><input type="checkbox" aria-labelledby="${id}-l"${item.checked ? ' checked' : ''}><span class="check-label" id="${id}-l">${item.html}</span>${item.revealHtml}</li>`;
    }).join('');
    return `<ul class="checklist">${lis}</ul>`;
  }
  const tag = block.ordered ? 'ol' : 'ul';
  const lis = block.items.map(raw => {
    const item = renderListItem(raw, ctx);
    return `<li>${item.html}${item.revealHtml}</li>`;
  }).join('');
  return `<${tag}>${lis}</${tag}>`;
}

function renderParaBlock(block) {
  const lines = block.lines && block.lines.length ? block.lines : [block.text];
  const first = lines[0] || '';
  const wholeTrim = lines.join(' ').trim();
  const isQuizQuestion = /^\*\*\d+\.\s/.test(first);
  const isPureReveal = /^(Правильна відповідь:|Звір себе:)/.test(wholeTrim);

  if (isQuizQuestion) {
    const title = inlineRender(first);
    const rest = lines.slice(1);
    // рядок-відповідь може йти одразу без порожнього рядка — але зазвичай окремим блоком; тут лишається лише варіанти
    const opts = rest.length ? `<div class="q-opts">${rest.map(l => inlineRender(l)).join('<br>')}</div>` : '';
    return `<div class="quiz-q"><div class="q-title">${title}</div>${opts}</div>`;
  }
  if (isPureReveal) {
    return `<div class="quiz-q"><details class="reveal"><summary>Показати відповідь</summary><div class="reveal-body">${inlineRender(wholeTrim)}</div></details></div>`;
  }
  // «label: значення» рядки (напр. картка відео: Автор / Посилання / До уроку) — рядок за рядком, не одним реченням
  const labelLines = lines.length > 1 && lines.filter(l => /^\*\*[^*]+:\*\*/.test(l)).length >= Math.ceil(lines.length / 2);
  if (labelLines) {
    return `<p class="lesson-body">${lines.map(l => inlineRender(l)).join('<br>')}</p>`;
  }
  return `<p class="lesson-body">${inlineRender(lines.join(' '))}</p>`;
}

// Рендерить масив блоків тіла сторінки в HTML. Мутує ctx.headings/ctx.slugSet.
export function renderBody(blocks, ctx) {
  let html = '';
  let pq = []; // підряд ідучі pull-quote на сторінках нового патерну — сітка «цифра + підпис»
  const flushPq = () => { if (pq.length) { html += pq.length > 1 ? `<div class="pq-grid">${pq.join('')}</div>` : pq[0]; pq = []; } };
  for (const b of blocks) {
    if (!(ctx.redesign && b.kind === 'pullquote')) flushPq();
    if (b.kind === 'heading') {
      const id = slugify(b.text, ctx.slugSet);
      ctx.headings.push({ level: b.level, text: b.text, id });
      if (b.level === 2) ctx.currentH2 = b.text;
      const tag = `h${Math.min(Math.max(b.level, 2), 3)}`;
      const ico = ctx.redesign && b.level === 2 && SECTION_ICONS[b.text] ? icon(SECTION_ICONS[b.text]) : '';
      html += `<${tag} id="${id}"${ico ? ' class="has-ico"' : ''}>${ico ? `<span class="sec-ico">${ico}</span>` : ''}${inlineRender(b.text)}</${tag}>`;
      // патерн DOU: авторська ілюстрація біля смислового блоку (головна сцена «Що це» — через :::scene)
      const illo = ctx.redesign && b.level === 2 && b.text !== 'Що це' ? sectionIllo(ctx.pageSlug, b.text) : null;
      if (illo) html += `<figure class="sec-illo">${illo.svg}${illo.caption ? `<figcaption>${escapeHtml(illo.caption)}</figcaption>` : ''}</figure>`;
      continue;
    }
    if (b.kind === 'para') { html += renderParaBlock(b); continue; }
    if (b.kind === 'list') { html += renderList(b, ctx); continue; }
    if (b.kind === 'table') { html += renderTable(b); continue; }
    if (b.kind === 'blockquote') { html += `<blockquote>${inlineRender(b.text)}</blockquote>`; continue; }
    if (b.kind === 'rawhtml') { html += b.html; continue; }
    if (b.kind === 'statgroup') { html += renderStatGroup(b.items, ctx); continue; }
    if (b.kind === 'pullquote') {
      if (ctx.redesign) pq.push(renderPullQuote(b.fields, ctx)); else html += renderPullQuote(b.fields);
      continue;
    }
    if (b.kind === 'quiz') { html += renderQuiz(b, ctx); continue; }
    if (b.kind === 'directive') {
      if (b.type === 'cover') { html += renderCover(b.fields, 'course'); continue; }
      if (b.type === 'scene') { html += renderScene(b.fields, ctx); continue; }
      if (b.type === 'cards') { html += renderCards(b.fields); continue; }
      if (b.type === 'pairs') { html += renderPairs(b.fields); continue; }
      if (b.type === 'quote') { html += renderQuote(b.fields); continue; }
      if (b.type === 'video') { html += renderVideo(b.fields, ctx.videos || []); continue; }
      if (b.type === 'extvideo') { html += renderExtVideo(b.fields); continue; }
      if (b.type === 'say') { html += renderSay(b.fields, ctx); continue; }
      if (b.type === 'insight') { html += renderInsight(b.fields); continue; }
      continue;
    }
  }
  flushPq();
  return html;
}

export { escapeHtml };
