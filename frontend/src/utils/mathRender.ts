import katex from 'katex';

/**
 * 把容器内的 [data-math-inline] / [data-math-block] 占位元素渲染成 KaTeX 公式。
 * 编辑器将公式以 data-latex 属性形式序列化进 HTML，阅读页（详情页）用本函数补全渲染。
 */
export function renderMathInElement(root: HTMLElement | null) {
  if (!root) return;

  root.querySelectorAll<HTMLElement>('[data-math-inline]').forEach((el) => {
    const latex = el.getAttribute('data-latex') || '';
    try {
      el.innerHTML = katex.renderToString(latex, {
        throwOnError: false,
        displayMode: false,
      });
    } catch {
      /* 渲染失败时保留原样 */
    }
  });

  root.querySelectorAll<HTMLElement>('[data-math-block]').forEach((el) => {
    const latex = el.getAttribute('data-latex') || '';
    try {
      el.innerHTML = katex.renderToString(latex, {
        throwOnError: false,
        displayMode: true,
      });
    } catch {
      /* 渲染失败时保留原样 */
    }
  });
}
