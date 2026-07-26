import { Node, mergeAttributes } from '@tiptap/core';
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  NodeViewContent,
  type Editor,
} from '@tiptap/react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Select } from 'antd';
import { useTranslation } from '../../i18n';

export type CalloutType = 'info' | 'success' | 'warning' | 'danger';

export const CALLOUT_TYPES: {
  value: CalloutType;
  icon: string;
}[] = [
  { value: 'info', icon: 'ℹ️' },
  { value: 'success', icon: '✅' },
  { value: 'warning', icon: '⚠️' },
  { value: 'danger', icon: '⛔' },
];

const CALLOUT_LABEL_KEY: Record<CalloutType, string> = {
  info: 'calloutInfo',
  success: 'calloutSuccess',
  warning: 'calloutWarning',
  danger: 'calloutDanger',
};

function CalloutView({
  node,
  updateAttributes,
  editor,
}: {
  node: ProseMirrorNode;
  updateAttributes: (attrs: Record<string, unknown>) => void;
  editor: Editor;
}) {
  const { t } = useTranslation();
  const type = (node.attrs.type || 'info') as CalloutType;
  const meta =
    CALLOUT_TYPES.find((ct) => ct.value === type) || CALLOUT_TYPES[0];
  const editable = editor.isEditable;

  return (
    <NodeViewWrapper className={`callout callout--${type}`} data-callout>
      <div className="callout__icon" contentEditable={false}>
        {editable ? (
          <Select
            size="small"
            variant="borderless"
            value={type}
            options={CALLOUT_TYPES.map((ct) => ({
              value: ct.value,
              label: `${ct.icon} ${t(CALLOUT_LABEL_KEY[ct.value])}`,
            }))}
            onChange={(v) => updateAttributes({ type: v })}
            popupMatchSelectWidth={false}
            style={{ width: 96 }}
          />
        ) : (
          <span className="callout__emoji">{meta.icon}</span>
        )}
      </div>
      <NodeViewContent className="callout__content" />
    </NodeViewWrapper>
  );
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-type') || 'info',
        renderHTML: (attrs) => ({ 'data-type': attrs.type }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },

  addCommands() {
    return {
      setCallout:
        (type: CalloutType = 'info') =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { type },
            content: [{ type: 'paragraph' }],
          }),
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (type?: CalloutType) => ReturnType;
    };
  }
}
