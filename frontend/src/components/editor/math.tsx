import { useState, useMemo } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type Editor,
} from '@tiptap/react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import katex from 'katex';

function renderKatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex || '', {
      throwOnError: false,
      displayMode,
    });
  } catch (e) {
    return `<span class="math-error">${(e as Error).message}</span>`;
  }
}

function MathInlineView({
  node,
  updateAttributes,
  editor,
}: {
  node: ProseMirrorNode;
  updateAttributes: (attrs: Record<string, unknown>) => void;
  editor: Editor;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(node.attrs.latex || '');
  const html = useMemo(
    () => renderKatex(node.attrs.latex, false),
    [node.attrs.latex],
  );

  if (editing && editor.isEditable) {
    return (
      <NodeViewWrapper as="span" className="math-node math-inline math-editing">
        <input
          autoFocus
          className="math-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            updateAttributes({ latex: value });
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              updateAttributes({ latex: value });
              setEditing(false);
            }
            if (e.key === 'Escape') {
              setValue(node.attrs.latex);
              setEditing(false);
            }
          }}
        />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as="span"
      className="math-node math-inline"
      data-latex={node.attrs.latex}
      contentEditable={false}
      onClick={() => editor.isEditable && setEditing(true)}
      dangerouslySetInnerHTML={{
        __html: html || '<span class="math-empty">$</span>',
      }}
    />
  );
}

function MathBlockView({
  node,
  updateAttributes,
  editor,
}: {
  node: ProseMirrorNode;
  updateAttributes: (attrs: Record<string, unknown>) => void;
  editor: Editor;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(node.attrs.latex || '');
  const html = useMemo(
    () => renderKatex(node.attrs.latex, true),
    [node.attrs.latex],
  );

  if (editing && editor.isEditable) {
    return (
      <NodeViewWrapper as="div" className="math-node math-block math-editing">
        <textarea
          autoFocus
          className="math-input math-input--block"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            updateAttributes({ latex: value });
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              updateAttributes({ latex: value });
              setEditing(false);
            }
            if (e.key === 'Escape') {
              setValue(node.attrs.latex);
              setEditing(false);
            }
          }}
        />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as="div"
      className="math-node math-block"
      data-latex={node.attrs.latex}
      contentEditable={false}
      onClick={() => editor.isEditable && setEditing(true)}
      dangerouslySetInnerHTML={{
        __html: html || '<span class="math-empty">$$</span>',
      }}
    />
  );
}

export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-latex') || '',
        renderHTML: (attrs) => ({ 'data-latex': attrs.latex }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-math-inline]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-math-inline': '' }), ''];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathInlineView);
  },

  addCommands() {
    return {
      insertMathInline:
        (latex = '') =>
        ({ commands }) =>
          commands.insertContent({ type: 'mathInline', attrs: { latex } }),
    };
  },
});

export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-latex') || '',
        renderHTML: (attrs) => ({ 'data-latex': attrs.latex }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-math-block]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-math-block': '' }), ''];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView);
  },

  addCommands() {
    return {
      insertMathBlock:
        (latex = '') =>
        ({ commands }) =>
          commands.insertContent({ type: 'mathBlock', attrs: { latex } }),
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mathInline: {
      insertMathInline: (latex?: string) => ReturnType;
    };
    mathBlock: {
      insertMathBlock: (latex?: string) => ReturnType;
    };
  }
}
