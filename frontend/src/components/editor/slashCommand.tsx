import { Extension } from '@tiptap/core';
import type { Editor, Range } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import { PluginKey } from '@tiptap/pm/state';
import {
  FontSizeOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  CheckSquareOutlined,
  CodeOutlined,
  MinusOutlined,
  PictureOutlined,
  AlignLeftOutlined,
  TableOutlined,
  BgColorsOutlined,
  FunctionOutlined,
  NotificationOutlined,
} from '@ant-design/icons';
import { message } from 'antd';
import type { ComponentType } from 'react';
import { getT } from '../../i18n';
import { useThemeStore } from '../../store/themeStore';
import { uploadImage } from '../../api/upload';
import SlashCommandList, { type SlashCommandListRef } from './SlashCommandList';

export interface SlashItem {
  titleKey: string;
  descriptionKey: string;
  icon: ComponentType;
  searchTerms: string[];
  command: (props: { editor: Editor; range: Range }) => void;
}

export const SlashCommandKey = new PluginKey('slashCommand');

/** 通过隐藏的 file input 选择图片并上传，插入到光标处 */
function insertImageViaPicker(editor: Editor, range: Range) {
  editor.chain().focus().deleteRange(range).run();
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const res = await uploadImage(file);
      if (res.success && res.data?.url) {
        editor
          .chain()
          .focus()
          .setImage({ src: res.data.url })
          .run();
      } else if (res.message) {
        message.error(res.message);
      }
    } catch {
      message.error(getT(useThemeStore.getState().lang)('imgUploadFail'));
    } finally {
      input.remove();
    }
  };
  input.click();
}

export const getSlashItems = (): SlashItem[] => [
  {
    titleKey: 'slashText',
    descriptionKey: 'slashTextDesc',
    icon: AlignLeftOutlined,
    searchTerms: ['text', 'paragraph', 'zhengwen', '正文', '段落'],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    titleKey: 'slashH1',
    descriptionKey: 'slashH1Desc',
    icon: FontSizeOutlined,
    searchTerms: ['h1', 'heading', 'title', 'biaoti', '标题', 'yiji'],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode('heading', { level: 1 })
        .run(),
  },
  {
    titleKey: 'slashH2',
    descriptionKey: 'slashH2Desc',
    icon: FontSizeOutlined,
    searchTerms: ['h2', 'heading', 'title', 'biaoti', '标题', 'erji'],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode('heading', { level: 2 })
        .run(),
  },
  {
    titleKey: 'slashH3',
    descriptionKey: 'slashH3Desc',
    icon: FontSizeOutlined,
    searchTerms: ['h3', 'heading', 'title', 'biaoti', '标题', 'sanji'],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode('heading', { level: 3 })
        .run(),
  },
  {
    titleKey: 'slashBullet',
    descriptionKey: 'slashBulletDesc',
    icon: UnorderedListOutlined,
    searchTerms: ['ul', 'bullet', 'list', 'liebiao', '列表', 'wuxu'],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    titleKey: 'slashOrdered',
    descriptionKey: 'slashOrderedDesc',
    icon: OrderedListOutlined,
    searchTerms: ['ol', 'number', 'list', 'liebiao', '列表', 'youxu'],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    titleKey: 'slashTask',
    descriptionKey: 'slashTaskDesc',
    icon: CheckSquareOutlined,
    searchTerms: ['todo', 'task', 'check', 'daiban', '待办', 'renwu'],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    titleKey: 'slashQuote',
    descriptionKey: 'slashQuoteDesc',
    icon: AlignLeftOutlined,
    searchTerms: ['quote', 'blockquote', 'yinyong', '引用'],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    titleKey: 'slashCode',
    descriptionKey: 'slashCodeDesc',
    icon: CodeOutlined,
    searchTerms: ['code', 'pre', 'daima', '代码'],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    titleKey: 'slashDivider',
    descriptionKey: 'slashDividerDesc',
    icon: MinusOutlined,
    searchTerms: ['hr', 'divider', 'line', 'fengexian', '分割线'],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    titleKey: 'slashImage',
    descriptionKey: 'slashImageDesc',
    icon: PictureOutlined,
    searchTerms: ['image', 'picture', 'img', 'tupian', '图片'],
    command: ({ editor, range }) => insertImageViaPicker(editor, range),
  },
  {
    titleKey: 'slashTable',
    descriptionKey: 'slashTableDesc',
    icon: TableOutlined,
    searchTerms: ['table', 'biaoge', '表格', 'grid'],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    titleKey: 'slashHighlight',
    descriptionKey: 'slashHighlightDesc',
    icon: BgColorsOutlined,
    searchTerms: ['highlight', 'gaoguang', '高亮', 'mark'],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleHighlight().run(),
  },
  {
    titleKey: 'slashCallout',
    descriptionKey: 'slashCalloutDesc',
    icon: NotificationOutlined,
    searchTerms: ['callout', 'gaoliangkuai', '高亮块', '提示', '警告'],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setCallout('info').run(),
  },
  {
    titleKey: 'slashMathInline',
    descriptionKey: 'slashMathInlineDesc',
    icon: FunctionOutlined,
    searchTerms: ['math', 'formula', 'gongshi', '公式', 'tex', 'latex'],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertMathInline('').run(),
  },
  {
    titleKey: 'slashMathBlock',
    descriptionKey: 'slashMathBlockDesc',
    icon: FunctionOutlined,
    searchTerms: ['math', 'formula', 'block', 'gongshi', '公式', 'tex', 'latex'],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertMathBlock('').run(),
  },
];

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        allowSpaces: false,
        startOfLine: false,
        pluginKey: SlashCommandKey,
        items: ({ query }) => {
          const q = query.toLowerCase().trim();
          const all = getSlashItems();
          if (!q) return all;
          return all.filter((item) =>
            item.searchTerms.some((term) => term.toLowerCase().includes(q)),
          );
        },
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
        render: () => {
          let component: ReactRenderer<SlashCommandListRef> | null = null;
          let popup: HTMLDivElement | null = null;

          const positionPopup = (rect: DOMRect | null | undefined) => {
            if (!popup || !rect) return;
            popup.style.left = `${rect.left + window.scrollX}px`;
            popup.style.top = `${rect.bottom + window.scrollY + 6}px`;
          };

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashCommandList, {
                props,
                editor: props.editor,
              });
              popup = document.createElement('div');
              popup.className = 'slash-command-popup';
              popup.style.position = 'absolute';
              popup.style.zIndex = '1200';
              document.body.appendChild(popup);
              popup.appendChild(component.element);
              positionPopup(props.clientRect?.());
            },
            onUpdate: (props) => {
              component?.updateProps(props);
              positionPopup(props.clientRect?.());
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                popup?.remove();
                popup = null;
                return true;
              }
              return component?.ref?.onKeyDown(props) ?? false;
            },
            onExit: () => {
              popup?.remove();
              popup = null;
              component?.destroy();
              component = null;
            },
          };
        },
      }),
    ];
  },
});
