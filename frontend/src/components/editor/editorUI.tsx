import React, { useState, useCallback } from 'react';
import { type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import {
  Button,
  Popover,
  Input,
  Tooltip,
  Space,
  Divider,
} from 'antd';
import {
  BoldOutlined,
  ItalicOutlined,
  StrikethroughOutlined,
  UnderlineOutlined,
  CodeOutlined,
  LinkOutlined,
  CheckOutlined,
  UndoOutlined,
  RedoOutlined,
  AlignLeftOutlined,
  AlignCenterOutlined,
  AlignRightOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  CheckSquareOutlined,
  CommentOutlined,
  MinusOutlined,
  PictureOutlined,
  ClearOutlined,
  TableOutlined,
  BgColorsOutlined,
  FunctionOutlined,
  NotificationOutlined,
} from '@ant-design/icons';
import { message, Select } from 'antd';
import { uploadImage } from '../../api/upload';
import { FONT_SIZES } from './fontSize';
import { useTranslation } from '../../i18n';

/* ------------------------------------------------------------------ */
/* 通用：小图标按钮                                                     */
/* ------------------------------------------------------------------ */

function IconButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip title={title}>
      <Button
        type="text"
        size="small"
        className={active ? 'editor-btn is-active' : 'editor-btn'}
        onClick={onClick}
        icon={children}
      />
    </Tooltip>
  );
}

/* ------------------------------------------------------------------ */
/* 链接控制：气泡菜单 / 顶部工具栏共用                                    */
/* ------------------------------------------------------------------ */

export function LinkControl({ editor }: { editor: Editor }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  const openPopover = () => {
    setValue((editor.getAttributes('link').href as string) || '');
    setOpen(true);
  };

  const apply = () => {
    const url = value.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href })
        .run();
    }
    setOpen(false);
  };

  const remove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setOpen(false);
  };

  const content = (
    <div style={{ width: 260 }}>
      <Input
        placeholder={t('linkPlaceholder')}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onPressEnter={apply}
        autoFocus
      />
      <div
        style={{
          marginTop: 8,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <Button size="small" onClick={remove}>
          {t('linkRemove')}
        </Button>
        <Button
          size="small"
          type="primary"
          icon={<CheckOutlined />}
          onClick={apply}
        >
          {t('linkConfirm')}
        </Button>
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      title={t('linkTitle')}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottom"
    >
      <Button
        type="text"
        size="small"
        className={
          editor.isActive('link') ? 'editor-btn is-active' : 'editor-btn'
        }
        onClick={openPopover}
        icon={<LinkOutlined />}
      />
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* 图片上传（顶部工具栏 / 拖拽共用）                                      */
/* ------------------------------------------------------------------ */

export function useImageUpload(editor: Editor | null) {
  const { t } = useTranslation();
  return useCallback(
    async (file: File) => {
      if (!editor) return;
      try {
        const res = await uploadImage(file);
        if (res.success && res.data?.url) {
          editor.chain().focus().setImage({ src: res.data.url }).run();
        } else if (res.message) {
          message.error(res.message);
        }
      } catch {
        message.error(t('imgUploadFail'));
      }
    },
    [editor, t],
  );
}

/* ------------------------------------------------------------------ */
/* 文字颜色 / 高亮颜色控制                                              */
/* ------------------------------------------------------------------ */

const TEXT_COLORS = [
  '#1f1f1f', '#cf1322', '#d4380d', '#d46b08', '#d4b106',
  '#389e0d', '#08979c', '#1677ff', '#531dab', '#c41d7f',
  '#ffffff', '#bfbfbf',
];

const HIGHLIGHT_COLORS = [
  '#fff3a3', '#ffe7ba', '#ffccc7', '#ffd6e7', '#d6e4ff',
  '#d9f7be', '#b5f5ec', '#efdbff', '#ffd8bf', '#f9f0ff',
];

export function ColorControl({
  editor,
  mode,
}: {
  editor: Editor;
  mode: 'text' | 'highlight';
}) {
  const { t } = useTranslation();
  const isText = mode === 'text';
  const [open, setOpen] = useState(false);

  const current = isText
    ? ((editor.getAttributes('textStyle').color as string) || '')
    : ((editor.getAttributes('highlight').color as string) || '');

  const apply = (color?: string) => {
    if (isText) {
      if (color) editor.chain().focus().setColor(color).run();
      else editor.chain().focus().unsetColor().run();
    } else {
      if (color) editor.chain().focus().setHighlight({ color }).run();
      else editor.chain().focus().unsetHighlight().run();
    }
    setOpen(false);
  };

  const palette = isText ? TEXT_COLORS : HIGHLIGHT_COLORS;

  const content = (
    <div style={{ width: 232, padding: 10 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 6,
        }}
      >
        {palette.map((c) => (
          <Tooltip key={c} title={c}>
            <button
              type="button"
              onClick={() => apply(c)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border:
                  current && current.toLowerCase() === c.toLowerCase()
                    ? '2px solid #1677ff'
                    : '1px solid #d9d9d9',
                background: c,
                cursor: 'pointer',
              }}
            />
          </Tooltip>
        ))}
        <label
          title={t('colorCustom')}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: '1px dashed #d9d9d9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: 16,
            color: '#999',
          }}
        >
          ＋
          <input
            type="color"
            onChange={(e) => apply(e.target.value)}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
          />
        </label>
      </div>
      <Button
        size="small"
        block
        style={{ marginTop: 10 }}
        onClick={() => apply(undefined)}
      >
        {isText ? t('clearColor') : t('clearHighlight')}
      </Button>
    </div>
  );

  return (
    <Popover
      content={content}
      title={isText ? t('colorText') : t('colorHighlight')}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottom"
    >
      {isText ? (
        <Button
          type="text"
          size="small"
          className={current ? 'editor-btn is-active' : 'editor-btn'}
          icon={
            <span
              style={{
                fontWeight: 700,
                fontSize: 14,
                lineHeight: 1,
                borderBottom: `3px solid ${current || '#1677ff'}`,
              }}
            >
              A
            </span>
          }
        />
      ) : (
        <Button
          type="text"
          size="small"
          className={
            editor.isActive('highlight') ? 'editor-btn is-active' : 'editor-btn'
          }
          icon={<BgColorsOutlined />}
        />
      )}
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* 字号控制                                                            */
/* ------------------------------------------------------------------ */

export function FontSizeControl({ editor }: { editor: Editor }) {
  const { t } = useTranslation();
  const current =
    ((editor.getAttributes('fontSize').size as string) || '') || '16px';

  return (
    <Select
      size="small"
      variant="borderless"
      value={current}
      style={{ width: 78 }}
      popupMatchSelectWidth={false}
      options={[
        { value: 'unset', label: t('fontSizeDefault') },
        ...FONT_SIZES.map((f) => ({ value: f.value, label: `${f.label} px` })),
      ]}
      onSelect={(v: string) => {
        if (v === 'unset') editor.chain().focus().unsetFontSize().run();
        else editor.chain().focus().setFontSize(v).run();
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* 表格菜单（插入 / 行列操作）                                          */
/* ------------------------------------------------------------------ */

export function TableMenu({ editor }: { editor: Editor }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const inTable = editor.isActive('table');

  const insert = (rows: number, cols: number) => {
    editor
      .chain()
      .focus()
      .insertTable({ rows, cols, withHeaderRow: true })
      .run();
    setOpen(false);
  };

  const content = (
    <div style={{ width: 248, padding: 10 }}>
      {!inTable && (
        <>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
            {t('tableInsertGrid')}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: 4,
            }}
          >
            {Array.from({ length: 48 }).map((_, i) => {
              const r = Math.floor(i / 8) + 1;
              const c = (i % 8) + 1;
              return (
                <button
                  key={i}
                  type="button"
                  title={`${r} × ${c}`}
                  onClick={() => insert(r, c)}
                  style={{
                    height: 18,
                    border: '1px solid #d9d9d9',
                    borderRadius: 3,
                    cursor: 'pointer',
                    background: '#fafafa',
                  }}
                />
              );
            })}
          </div>
          <Button
            size="small"
            block
            style={{ marginTop: 10 }}
            onClick={() => insert(3, 3)}
          >
            {t('tableInsert3x3')}
          </Button>
        </>
      )}
      {inTable && (
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
          <Button
            block
            size="small"
            onClick={() => {
              editor.chain().focus().addRowBefore().run();
              setOpen(false);
            }}
          >
            {t('tableInsertRowAbove')}
          </Button>
          <Button
            block
            size="small"
            onClick={() => {
              editor.chain().focus().addRowAfter().run();
              setOpen(false);
            }}
          >
            {t('tableInsertRowBelow')}
          </Button>
          <Button
            block
            size="small"
            onClick={() => {
              editor.chain().focus().addColumnBefore().run();
              setOpen(false);
            }}
          >
            {t('tableInsertColLeft')}
          </Button>
          <Button
            block
            size="small"
            onClick={() => {
              editor.chain().focus().addColumnAfter().run();
              setOpen(false);
            }}
          >
            {t('tableInsertColRight')}
          </Button>
          <Button
            block
            size="small"
            onClick={() => {
              editor.chain().focus().toggleHeaderRow().run();
              setOpen(false);
            }}
          >
            {t('tableToggleHeader')}
          </Button>
          <Button
            block
            size="small"
            danger
            onClick={() => {
              editor.chain().focus().deleteRow().run();
              setOpen(false);
            }}
          >
            {t('tableDeleteRow')}
          </Button>
          <Button
            block
            size="small"
            danger
            onClick={() => {
              editor.chain().focus().deleteColumn().run();
              setOpen(false);
            }}
          >
            {t('tableDeleteCol')}
          </Button>
          <Button
            block
            size="small"
            danger
            onClick={() => {
              editor.chain().focus().deleteTable().run();
              setOpen(false);
            }}
          >
            {t('tableDeleteTable')}
          </Button>
        </Space>
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      title={t('tableMenuTitle')}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottom"
    >
      <Button
        type="text"
        size="small"
        className={inTable ? 'editor-btn is-active' : 'editor-btn'}
        icon={<TableOutlined />}
      />
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* 气泡菜单（选中文字时浮出）                                            */
/* ------------------------------------------------------------------ */

export function BubbleToolbar({ editor }: { editor: Editor }) {
  const { t } = useTranslation();
  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: ed, state, from, to }) => {
        const { empty } = state.selection;
        const text = state.doc.textBetween(from, to);
        if (empty || !text.trim()) return false;
        if (ed.isActive('codeBlock')) return false;
        return true;
      }}
      options={{ placement: 'top' }}
    >
      <div className="bubble-toolbar">
        <IconButton
          title={t('fmtBold')}
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <BoldOutlined />
        </IconButton>
        <IconButton
          title={t('fmtItalic')}
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <ItalicOutlined />
        </IconButton>
        <IconButton
          title={t('fmtStrike')}
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <StrikethroughOutlined />
        </IconButton>
        <IconButton
          title={t('fmtUnderline')}
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineOutlined />
        </IconButton>
        <IconButton
          title={t('fmtCode')}
          active={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <CodeOutlined />
        </IconButton>
        <LinkControl editor={editor} />
        <ColorControl editor={editor} mode="text" />
        <ColorControl editor={editor} mode="highlight" />
        <Divider type="vertical" />
        <IconButton
          title={t('alignLeft')}
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeftOutlined />
        </IconButton>
        <IconButton
          title={t('alignCenter')}
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenterOutlined />
        </IconButton>
        <IconButton
          title={t('alignRight')}
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <AlignRightOutlined />
        </IconButton>
        <IconButton
          title={t('fmtQuote')}
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <CommentOutlined />
        </IconButton>
      </div>
    </BubbleMenu>
  );
}

/* ------------------------------------------------------------------ */
/* 顶部工具栏                                                           */
/* ------------------------------------------------------------------ */

export function EditorToolbar({
  editor,
  onImage,
}: {
  editor: Editor;
  onImage: (file: File) => void;
}) {
  const { t } = useTranslation();
  const pickImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) await onImage(file);
      input.remove();
    };
    input.click();
  };

  return (
    <div className="editor-toolbar">
      <Space size={2} wrap>
        <IconButton
          title={t('undo')}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <UndoOutlined />
        </IconButton>
        <IconButton
          title={t('redo')}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <RedoOutlined />
        </IconButton>

        <Divider type="vertical" />

        <IconButton
          title={t('fmtParagraph')}
          active={editor.isActive('paragraph')}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          <AlignLeftOutlined />
        </IconButton>
        <IconButton
          title={t('h1')}
          active={editor.isActive('heading', { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          <b style={{ fontSize: 13 }}>H1</b>
        </IconButton>
        <IconButton
          title={t('h2')}
          active={editor.isActive('heading', { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <b style={{ fontSize: 13 }}>H2</b>
        </IconButton>
        <IconButton
          title={t('h3')}
          active={editor.isActive('heading', { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          <b style={{ fontSize: 13 }}>H3</b>
        </IconButton>

        <Divider type="vertical" />

        <IconButton
          title={t('alignLeft')}
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeftOutlined />
        </IconButton>
        <IconButton
          title={t('alignCenter')}
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenterOutlined />
        </IconButton>
        <IconButton
          title={t('alignRight')}
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <AlignRightOutlined />
        </IconButton>
        <FontSizeControl editor={editor} />

        <Divider type="vertical" />

        <IconButton
          title={t('fmtBold')}
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <BoldOutlined />
        </IconButton>
        <IconButton
          title={t('fmtItalic')}
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <ItalicOutlined />
        </IconButton>
        <IconButton
          title={t('fmtStrike')}
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <StrikethroughOutlined />
        </IconButton>
        <IconButton
          title={t('fmtUnderline')}
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineOutlined />
        </IconButton>
        <IconButton
          title={t('fmtCode')}
          active={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <CodeOutlined />
        </IconButton>
        <LinkControl editor={editor} />

        <Divider type="vertical" />

        <IconButton
          title={t('listBullet')}
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <UnorderedListOutlined />
        </IconButton>
        <IconButton
          title={t('listOrdered')}
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <OrderedListOutlined />
        </IconButton>
        <IconButton
          title={t('listTask')}
          active={editor.isActive('taskList')}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          <CheckSquareOutlined />
        </IconButton>
        <IconButton
          title={t('fmtQuote')}
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <CommentOutlined />
        </IconButton>
        <IconButton
          title={t('fmtCodeBlock')}
          active={editor.isActive('codeBlock')}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <CodeOutlined />
        </IconButton>
        <IconButton
          title={t('fmtDivider')}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <MinusOutlined />
        </IconButton>
        <IconButton title={t('insertImage')} onClick={pickImage}>
          <PictureOutlined />
        </IconButton>
        <ColorControl editor={editor} mode="text" />
        <ColorControl editor={editor} mode="highlight" />
        <TableMenu editor={editor} />
        <Divider type="vertical" />
        <IconButton
          title={t('insertCallout')}
          active={editor.isActive('callout')}
          onClick={() => editor.chain().focus().setCallout('info').run()}
        >
          <NotificationOutlined />
        </IconButton>
        <IconButton
          title={t('mathInline')}
          active={editor.isActive('mathInline')}
          onClick={() => editor.chain().focus().insertMathInline('').run()}
        >
          <FunctionOutlined />
        </IconButton>
        <IconButton
          title={t('mathBlock')}
          active={editor.isActive('mathBlock')}
          onClick={() => editor.chain().focus().insertMathBlock('').run()}
        >
          <FunctionOutlined />
        </IconButton>
        <IconButton
          title={t('clearFormat')}
          onClick={() =>
            editor.chain().focus().unsetAllMarks().clearNodes().run()
          }
        >
          <ClearOutlined />
        </IconButton>
      </Space>
    </div>
  );
}
