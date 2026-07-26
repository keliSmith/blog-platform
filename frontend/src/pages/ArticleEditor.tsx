import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Upload,
  Typography,
  Space,
  Row,
  Col,
  message,
  Spin,
  Segmented,
} from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { TableKit } from '@tiptap/extension-table';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { createArticle, updateArticle, getArticle } from '../api/articles';
import { getCategories } from '../api/categories';
import { getTags } from '../api/tags';
import { uploadCover, uploadImage } from '../api/upload';
import { SlashCommand } from '../components/editor/slashCommand';
import { BubbleToolbar, EditorToolbar } from '../components/editor/editorUI';
import { Callout } from '../components/editor/callout';
import { MathInline, MathBlock } from '../components/editor/math';
import { FontSize } from '../components/editor/fontSize';
import type { Category, Tag, ArticleFormData } from '../types';
import '../styles/prose.css';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github.css';
import { useTranslation } from '../i18n';

const { Title } = Typography;
const { TextArea } = Input;
const { Dragger } = Upload;

const lowlight = createLowlight(common);

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

function isHtml(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str || '');
}

function mdToHtml(md: string): string {
  return marked.parse(md || '', { async: false }) as string;
}

function ArticleEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { t } = useTranslation();

  const [form] = Form.useForm<ArticleFormData>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string>('');
  const [coverFileList, setCoverFileList] = useState<UploadFile[]>([]);

  // 双模式编辑：富文本 / Markdown
  const [editorMode, setEditorMode] = useState<'rich' | 'markdown'>('rich');
  const [markdownValue, setMarkdownValue] = useState<string>('');
  const [initialContent, setInitialContent] = useState<string>('');

  const editorRef = useRef<Editor | null>(null);

  const uploadImageFile = useCallback(async (file: File) => {
    const ed = editorRef.current;
    if (!ed) return;
    try {
      const res = await uploadImage(file);
      if (res.success && res.data?.url) {
        ed.chain().focus().setImage({ src: res.data.url }).run();
      } else if (res.message) {
        message.error(res.message);
      }
    } catch {
      message.error(t('imgUploadFail'));
    }
  }, [t]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: {
            class: 'article-link',
            rel: 'noopener noreferrer nofollow',
            target: '_blank',
          },
        },
      }),
      Placeholder.configure({
        placeholder: t('placeholderEditor'),
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: { class: 'editor-image' },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: true } }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      CodeBlockLowlight.configure({ lowlight }),
      FontSize,
      Callout,
      MathInline,
      MathBlock,
      SlashCommand,
    ],
    content: '',
    editorProps: {
      attributes: { class: 'article-prose' },
      handlePaste: (_view, event) => {
        const files = (event as ClipboardEvent).clipboardData?.files;
        const img =
          files && Array.from(files).find((f) => f.type.startsWith('image/'));
        if (img && editorRef.current) {
          void uploadImageFile(img);
          return true;
        }
        return false;
      },
      handleDrop: (_view, event) => {
        const dt = (event as DragEvent).dataTransfer;
        const img =
          dt?.files &&
          Array.from(dt.files).find((f) => f.type.startsWith('image/'));
        if (img && editorRef.current) {
          void uploadImageFile(img);
          return true;
        }
        return false;
      },
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // 字数 / 阅读时长 / 大纲（语雀风格）
  const [wordCount, setWordCount] = useState(0);
  const [readingMinutes, setReadingMinutes] = useState(0);
  const [outline, setOutline] = useState<
    { level: number; text: string; pos: number }[]
  >([]);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const text = editor.getText();
      const chars = text.replace(/\s/g, '').length;
      setWordCount(chars);
      setReadingMinutes(Math.max(1, Math.round(chars / 400)));
      const items: { level: number; text: string; pos: number }[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          items.push({
            level: node.attrs.level,
            text: node.textContent || t('untitled'),
            pos,
          });
        }
      });
      setOutline(items);
    };
    sync();
    editor.on('update', sync);
    return () => {
      editor.off('update', sync);
    };
  }, [editor, initialContent, t]);

  // 自动保存到本地草稿（localStorage），模拟语雀的“已自动保存”
  useEffect(() => {
    if (!editor) return;
    const autosave = () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        try {
          const key = id ? `draft:article:${id}` : 'draft:article:new';
          localStorage.setItem(key, editor.getHTML());
          setSavedAt(new Date());
        } catch {
          /* 忽略存储异常 */
        }
      }, 800);
    };
    editor.on('update', autosave);
    return () => {
      editor.off('update', autosave);
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [editor, id]);

  const jumpToHeading = useCallback((pos: number) => {
    editorRef.current?.chain().focus().setTextSelection(pos + 1).scrollIntoView().run();
  }, []);

  // 文章加载完成后，把已有正文填入编辑器 / Markdown 源
  useEffect(() => {
    if (!editor) return;
    const html = initialContent || '';
    if (isHtml(html)) {
      editor.commands.setContent(html, { emitUpdate: false });
      setMarkdownValue(turndownService.turndown(html));
    } else {
      editor.commands.setContent('', { emitUpdate: false });
      setMarkdownValue(html);
    }
  }, [editor, initialContent]);

  const fetchMeta = useCallback(async () => {
    try {
      const [catRes, tagRes] = await Promise.all([getCategories(), getTags()]);
      if (catRes.success && catRes.data) setCategories(catRes.data);
      if (tagRes.success && tagRes.data) setTags(tagRes.data);
    } catch {
      // ignore
    }
  }, []);

  const fetchArticle = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getArticle(Number(id));
      if (res.success && res.data) {
        const article = res.data;
        form.setFieldsValue({
          title: article.title,
          slug: article.slug,
          summary: article.summary,
          status: article.status,
          category_id: article.category_id,
          tags: article.tags?.map((t) => t.id),
          cover_image: article.cover_image,
        });
        setInitialContent(article.content || '');
        if (article.cover_image) {
          setCoverUrl(article.cover_image);
          setCoverFileList([
            {
              uid: '-1',
              name: 'cover.png',
              status: 'done',
              url: article.cover_image,
            },
          ]);
        }
      }
    } catch {
      message.error(t('loadArticleFail'));
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [id, form, navigate, t]);

  useEffect(() => {
    fetchMeta();
    if (isEdit) fetchArticle();
  }, [fetchMeta, fetchArticle, isEdit]);

  const getCurrentContent = useCallback((): string => {
    if (editorMode === 'rich') return editor?.getHTML() || '';
    return mdToHtml(markdownValue);
  }, [editorMode, editor, markdownValue]);

  const getPlainText = useCallback((): string => {
    if (editorMode === 'rich') return (editor?.getText() || '').trim();
    return markdownValue.trim();
  }, [editorMode, editor, markdownValue]);

  // 统一保存逻辑：forceStatus 决定保存为草稿还是发布
  const handleSave = useCallback(
    async (payload: ArticleFormData, forceStatus: 'draft' | 'published') => {
      setSubmitting(true);
      try {
        if (isEdit && id) {
          const res = await updateArticle(Number(id), payload);
          if (res.success) {
            if (forceStatus === 'draft') {
              message.success(t('draftSaved'));
              navigate('/my-articles');
            } else {
              message.success(t('articleUpdated'));
              navigate('/');
            }
          }
        } else {
          const res = await createArticle(payload);
          if (res.success) {
            if (forceStatus === 'draft') {
              message.success(t('draftSaved'));
              navigate('/my-articles');
            } else {
              message.success(t('articlePublished'));
              navigate(`/articles/${res.data?.slug || ''}`, { replace: true });
            }
          }
        }
      } catch (err: unknown) {
        message.error(err instanceof Error ? err.message : t('saveFail'));
      } finally {
        setSubmitting(false);
      }
    },
    [isEdit, id, navigate, t],
  );

  // 组装提交数据（slug 为空时不上传，交由后端自动生成）
  const buildPayload = useCallback(
    (values: Partial<ArticleFormData>, forceStatus: 'draft' | 'published'): ArticleFormData => {
      const payload: ArticleFormData = {
        title: (values.title || '').trim(),
        content: getCurrentContent(),
        summary: values.summary?.trim() || undefined,
        status: forceStatus,
        category_id: values.category_id,
        tags: values.tags || [],
        cover_image: values.cover_image,
      };
      const slug = values.slug?.trim();
      if (slug) payload.slug = slug;
      return payload;
    },
    [getCurrentContent],
  );

  // 发布 / 更新：校验标题与正文
  const handleSubmit = (values: Partial<ArticleFormData>) => {
    if (!values.title?.trim()) {
      message.warning(t('titleRequired'));
      return;
    }
    if (!getPlainText()) {
      message.warning(t('contentRequired'));
      return;
    }
    handleSave(buildPayload(values, 'published'), 'published');
  };

  // 保存草稿：仅要求标题，slug 与正文可空（后端自动生成 slug）
  const handleSaveDraft = async () => {
    const values = form.getFieldsValue(true) as Partial<ArticleFormData>;
    if (!values.title || !values.title.trim()) {
      message.warning(t('draftTitleRequired'));
      return;
    }
    handleSave(buildPayload(values, 'draft'), 'draft');
  };

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isEdit) {
        const slug = e.target.value
          .toLowerCase()
          .replace(/[^a-z0-9一-龥]+/g, '-')
          .replace(/^-+|-+$/g, '');
        form.setFieldValue('slug', slug);
      }
    },
    [form, isEdit],
  );

  const switchMode = (mode: 'rich' | 'markdown') => {
    if (mode === editorMode) return;
    if (mode === 'markdown') {
      const html = editor?.getHTML() || '';
      setMarkdownValue(isHtml(html) ? turndownService.turndown(html) : html);
    } else {
      editor?.commands.setContent(mdToHtml(markdownValue), { emitUpdate: false });
    }
    setEditorMode(mode);
  };

  const handleUpload = useCallback(
    async (file: File): Promise<false> => {
      try {
        const res = await uploadCover(file);
        if (res.success && res.data?.url) {
          const url = res.data.url;
          setCoverUrl(url);
          form.setFieldValue('cover_image', url);
          setCoverFileList([
            {
              uid: '-1',
              name: file.name,
              status: 'done',
              url,
              thumbUrl: url,
            },
          ]);
          message.success(t('coverUploaded'));
        } else if (res.message) {
          message.error(res.message);
        }
      } catch {
        message.error(t('uploadFailed'));
      }
      return false;
    },
    [form, t],
  );

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto' }}>
      <Title level={3} style={{ marginBottom: 24 }}>
        {isEdit ? t('editArticleTitle') : t('writeArticleTitle')}
      </Title>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card style={{ borderRadius: 8 }}>
            <Form<ArticleFormData>
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{}}
            >
          <Form.Item
            name="title"
            label={t('title')}
            rules={[{ required: true, message: 'Please enter the article title' }]}
          >
            <Input size="large" placeholder="Article title" onChange={handleTitleChange} />
          </Form.Item>

          <Form.Item
            name="slug"
            label={t('slugLabel')}
            tooltip={t('slugTooltip')}
          >
            <Input size="large" placeholder={t('slugPlaceholder')} />
          </Form.Item>

          <Form.Item name="summary" label={t('summary')}>
            <TextArea rows={3} placeholder={t('summaryPlaceholder')} />
          </Form.Item>

          <Form.Item label={t('content')}>
            <Segmented<'rich' | 'markdown'>
              value={editorMode}
              onChange={(v) => switchMode(v)}
              options={[
                { label: t('modeRich'), value: 'rich' },
                { label: t('modeMarkdown'), value: 'markdown' },
              ]}
              style={{ marginBottom: 12 }}
            />
            {editorMode === 'rich' ? (
              <div>
                {editor && <EditorToolbar editor={editor} onImage={uploadImageFile} />}
                <div className="editor-surface">
                  {editor && <BubbleToolbar editor={editor} />}
                  <EditorContent
                    editor={editor}
                    className="article-prose"
                    style={{
                      border: '1px solid #d9d9d9',
                      borderRadius: 8,
                      padding: 16,
                      minHeight: 360,
                      maxHeight: 640,
                      overflowY: 'auto',
                    }}
                  />
                </div>
                <div className="editor-hint">
                  {t('editorHint')}
                </div>
              </div>
            ) : (
              <TextArea
                value={markdownValue}
                onChange={(e) => setMarkdownValue(e.target.value)}
                rows={16}
                placeholder={t('markdownPlaceholder')}
                style={{ fontFamily: 'monospace', minHeight: 360 }}
              />
            )}
          </Form.Item>

          <Row gutter={[16, 0]}>
            <Col xs={24} md={12}>
              <Form.Item name="category_id" label={t('category')} style={{ marginBottom: 16 }}>
                <Select
                  placeholder={t('categoryPlaceholder')}
                  allowClear
                  options={categories.map((cat) => ({
                    value: cat.id,
                    label: cat.name,
                  }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item name="tags" label={t('tags')} style={{ marginBottom: 16 }}>
                <Select
                  mode="multiple"
                  placeholder={t('tagsPlaceholder')}
                  allowClear
                  options={tags.map((tag) => ({
                    value: tag.id,
                    label: tag.name,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="cover_image" label={t('coverImage')}>
            <Dragger
              name="file"
              multiple={false}
              accept="image/*"
              fileList={coverFileList}
              beforeUpload={handleUpload}
              onRemove={() => {
                setCoverUrl('');
                setCoverFileList([]);
                form.setFieldValue('cover_image', undefined);
              }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">{t('coverUploadText')}</p>
            </Dragger>
            {coverUrl && (
              <img
                src={coverUrl}
                alt="cover preview"
                style={{
                  marginTop: 12,
                  maxWidth: '100%',
                  maxHeight: 220,
                  borderRadius: 8,
                  objectFit: 'cover',
                }}
              />
            )}
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space wrap>
              <Button onClick={handleSaveDraft} loading={submitting} size="large">
                {t('saveDraft')}
              </Button>
              <Button type="primary" htmlType="submit" loading={submitting} size="large">
                {isEdit ? t('update') : t('publish')}
              </Button>
              <Button onClick={() => navigate(-1)} size="large">
                {t('cancel')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <div className="editor-statusbar">
        <span>{`${t('wordCount')} ${wordCount}`}</span>
        <span>{`· ${t('readMinutes', { n: readingMinutes })}`}</span>
        <span className="editor-statusbar__save">
          {savedAt
            ? `· ${t('autosaved')} ${savedAt.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
              })}`
            : t('editing')}
        </span>
      </div>
        </div>

        {outline.length > 0 && (
          <aside className="outline-panel">
            <div className="outline-panel__title">{t('outline')}</div>
            {outline.map((h, i) => (
              <button
                key={`${h.pos}-${i}`}
                type="button"
                className={`outline-item outline-item--l${h.level}`}
                onClick={() => jumpToHeading(h.pos)}
                title={h.text}
              >
                {h.text}
              </button>
            ))}
          </aside>
        )}
      </div>
    </div>
  );
}

export default ArticleEditor;
