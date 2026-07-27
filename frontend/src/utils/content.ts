/**
 * 从文章 HTML 正文中提取标题 / 摘要的工具函数（语雀风格）。
 * 全部基于浏览器 DOMParser，无第三方依赖。
 */

/** 去除 HTML 标签，返回纯文本（压缩多余空白）。 */
export function stripHtml(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
}

/**
 * 从 HTML 正文中提取文章标题：
 * 优先取第一个 <h1>，其次 <h2>/<h3>，再退而求其次取第一个有文本的块。
 * 都没有则返回 fallback。
 */
export function extractTitleFromHtml(html: string, fallback = ''): string {
  if (!html) return fallback;
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const h1 = doc.querySelector('h1');
  if (h1 && h1.textContent?.trim()) return h1.textContent.trim();

  const heading = doc.querySelector('h2, h3');
  if (heading && heading.textContent?.trim()) return heading.textContent.trim();

  const blocks = doc.body?.querySelectorAll('p, li, blockquote, td');
  for (const b of Array.from(blocks || [])) {
    const txt = b.textContent?.trim();
    if (txt) return txt;
  }

  return stripHtml(html) || fallback;
}

/**
 * 从 HTML 正文中提取第一段文本（用于卡片描述 / 摘要）：
 * 优先取第一个 <p>；若没有，则取首个非标题文本块（避免与标题重复）；
 * 最后才退而求其次用任意有文本的块。
 */
export function extractFirstParagraph(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const p = doc.querySelector('p');
  if (p && p.textContent?.trim()) return p.textContent.trim();

  const noHeading = doc.body?.querySelectorAll('li, blockquote, td, pre');
  for (const b of Array.from(noHeading || [])) {
    const txt = b.textContent?.trim();
    if (txt) return txt;
  }

  const any = doc.body?.querySelectorAll('p, li, blockquote, td, h1, h2, h3, pre');
  for (const b of Array.from(any || [])) {
    const txt = b.textContent?.trim();
    if (txt) return txt;
  }

  return stripHtml(html);
}

/** 生成截断后的简短摘要（用于后端 summary 字段）。 */
export function deriveSummary(html: string, maxLen = 120): string {
  const text = extractFirstParagraph(html);
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '…';
}

/**
 * 推导文章标题：完全从正文第一个标题（h1 → h2/h3 → 首个有文本的块）提取，
 * 不再依赖任何独立的标题输入框（语雀风格：标题就是正文第一行）。
 * 若正文为空，回退到 fallback（通常是 i18n 的“无标题文档”）。
 */
export function deriveTitle(html: string, fallback = ''): string {
  return extractTitleFromHtml(html) || fallback;
}

/**
 * 编辑已有文章时，把后端存储的 title 安全地前置为正文第一个 <h1>。
 * 若正文已以有文本的 <h1> 开头，则不重复添加。
 * 通过 DOMParser / textContent 写入，避免标题中的特殊字符破坏 HTML。
 */
export function prependTitleToHtml(title: string, html: string): string {
  if (!title) return html || '';
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  const first = doc.body.firstElementChild;
  if (first && first.tagName === 'H1' && (first.textContent || '').trim()) {
    return doc.body.innerHTML;
  }
  const h1 = doc.createElement('h1');
  h1.textContent = title;
  doc.body.insertBefore(h1, doc.body.firstChild);
  return doc.body.innerHTML;
}

/**
 * 从正文提取大纲（目录）：返回所有 h1/h2/h3 的层级与文本。
 * 用于详情页/阅读页的悬浮目录与滚动高亮。
 */
export function extractOutline(html: string): { level: number; text: string }[] {
  if (!html) return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const heads = doc.querySelectorAll('h1, h2, h3');
  const items: { level: number; text: string }[] = [];
  heads.forEach((h) => {
    const text = (h.textContent || '').trim();
    if (text) items.push({ level: Number(h.tagName[1]) || 1, text });
  });
  return items;
}

/** 根据正文估算阅读时长（分钟），中文按 ~400 字/分钟。 */
export function countReadingMinutes(html: string): number {
  const text = stripHtml(html);
  const chars = text.replace(/\s/g, '').length;
  return Math.max(1, Math.round(chars / 400));
}
