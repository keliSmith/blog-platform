 import { useState, useEffect, useCallback, useRef } from 'react';
 import { useNavigate } from 'react-router-dom';
 import { List, Avatar, Typography, Form, Input, Button, Space, Spin, Empty, message } from 'antd';
 import { UserOutlined, SendOutlined } from '@ant-design/icons';
 import type { Comment } from '../types';
 import { getArticleComments, createComment } from '../api/comments';
 import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../i18n';
 
const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface CommentListProps {
  articleId: number;
}

function formatDate(dateStr?: string, t?: (key: string, vars?: Record<string, string | number>) => string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (!t) return '';
  if (minutes < 1) return t('justNow');
  if (minutes < 60) return t('minutesAgo', { n: minutes });
  if (hours < 24) return t('hoursAgo', { n: hours });
  if (days < 7) return t('daysAgo', { n: days });
 
   const year = date.getFullYear();
   const month = String(date.getMonth() + 1).padStart(2, '0');
   const day = String(date.getDate()).padStart(2, '0');
   return `${year}-${month}-${day}`;
 }
 
 interface ReplyFormValues {
   content: string;
 }
 
 function CommentList({ articleId }: CommentListProps) {
   const [comments, setComments] = useState<Comment[]>([]);
   const [loading, setLoading] = useState(true);
   const [replyTo, setReplyTo] = useState<number | null>(null);
   const [submitting, setSubmitting] = useState(false);
   const token = useAuthStore((state) => state.token);
  const [form] = Form.useForm<ReplyFormValues>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Guards against a stale response overwriting newer comments when the
  // article id changes under a reused component instance.
  const latestArticleIdRef = useRef<number | null>(null);

  const fetchComments = useCallback(async () => {
    latestArticleIdRef.current = articleId;
    setLoading(true);
    try {
      const res = await getArticleComments(articleId);
      if (latestArticleIdRef.current !== articleId) return;
      if (res.success && res.data) {
        setComments(res?.data?.items);
      }
    } catch {
      if (latestArticleIdRef.current !== articleId) return;
      message.error(t('loadCommentsFail'));
    } finally {
      if (latestArticleIdRef.current === articleId) setLoading(false);
    }
  }, [articleId, t]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = useCallback(
    async (parentId?: number) => {
      // Consistent with the like/favorite buttons: the comment box is always
      // usable, and an anonymous visitor is guided to login instead of being
      // blocked silently.
      if (!token) {
        message.warning(t('pleaseLoginToComment'));
        navigate('/login');
        return;
      }

      try {
        const values = await form.validateFields();
        setSubmitting(true);
        const data: { content: string; parent_id?: number } = { content: values.content };
        if (parentId) data.parent_id = parentId;
        const res = await createComment(articleId, data);
        if (res.success) {
          message.success(t('commentSuccess'));
          form.resetFields();
          setReplyTo(null);
          fetchComments();
        }
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'errorFields' in error) {
          return;
        }
        message.error(t('submitCommentFail'));
      } finally {
        setSubmitting(false);
      }
    },
    [token, articleId, form, fetchComments, t, navigate],
  );
 
   const handleReply = useCallback((commentId: number) => {
     setReplyTo((prev) => (prev === commentId ? null : commentId));
     form.resetFields();
   }, [form]);
 
   const renderComment = (comment: Comment, isReply = false) => (
     <div
       key={comment.id}
       style={{
         padding: '12px 0',
         borderBottom: isReply ? 'none' : '1px solid #f0f0f0',
         marginLeft: isReply ? 48 : 0,
       }}
     >
       <Space align="start" size={12}>
         <Avatar
           size={32}
           icon={<UserOutlined />}
           style={{ flexShrink: 0 }}
         />
         <div style={{ flex: 1, minWidth: 0 }}>
           <Space>
             <Text strong style={{ fontSize: 14 }}>
               {comment.user?.username || t('anonymousUser')}
             </Text>
             <Text type="secondary" style={{ fontSize: 12 }}>
               {formatDate(comment.created_at, t)}
             </Text>
           </Space>
           <Paragraph
             style={{ margin: '4px 0 8px', fontSize: 14, whiteSpace: 'pre-wrap' }}
           >
             {comment.content}
           </Paragraph>
           <Button
             type="link"
             size="small"
             icon={<SendOutlined />}
              onClick={() => handleReply(comment.id)}
              style={{ padding: 0 }}
            >
              {t('reply')}
            </Button>
 
           {replyTo === comment.id && (
            <div style={{ marginTop: 8 }}>
              <Form form={form} onFinish={() => handleSubmit(comment.id)}>
                <Form.Item
                  name="content"
                  rules={[{ required: true, message: t('replyContentRequired') }]}
                  style={{ marginBottom: 8 }}
                >
                  <TextArea
                    rows={2}
                    placeholder={t('replyPlaceholder', { name: comment.user?.username || t('anonymousUser') })}
                  />
                </Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType={token ? 'submit' : undefined}
                    onClick={token ? undefined : () => { message.warning(t('pleaseLoginToComment')); navigate('/login'); }}
                    loading={submitting}
                    size="small"
                  >
                    {t('submitReply')}
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setReplyTo(null)}
                  >
                    {t('cancel')}
                  </Button>
                </Space>
              </Form>
            </div>
           )}
 
           {comment.replies?.map((reply) => renderComment(reply, true))}
         </div>
       </Space>
     </div>
   );
 
   if (loading) {
     return (
       <div style={{ textAlign: 'center', padding: 32 }}>
         <Spin tip={t('loadingComments')} />
       </div>
     );
   }
 
   return (
     <div>
       <Text strong style={{ fontSize: 16, marginBottom: 16, display: 'block' }}>
        {t('comments')} ({comments.length})
       </Text>
 
      {/* New comment form — always visible, just like the like/favorite
          buttons. Anonymous visitors can open it and are guided to login on
          submit instead of the box being hidden from them. */}
      <div style={{ marginBottom: 16, padding: 16, background: '#fafafa', borderRadius: 8 }}>
        {!token && (
          <div style={{ marginBottom: 8 }}>
            <Text type="secondary">{t('loginToCommentHint')} </Text>
            <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate('/login')}>
              {t('login')}
            </Button>
          </div>
        )}
        <Form form={form} onFinish={() => handleSubmit()}>
          <Form.Item
            name="content"
            rules={[{ required: true, message: t('commentContentRequired') }]}
            style={{ marginBottom: 8 }}
          >
            <TextArea rows={3} placeholder={t('newCommentPlaceholder')} />
          </Form.Item>
          <Button
            type="primary"
            htmlType={token ? 'submit' : undefined}
            onClick={token ? undefined : () => { message.warning(t('pleaseLoginToComment')); navigate('/login'); }}
            loading={submitting}
            icon={<SendOutlined />}
          >
            {t('postComment')}
          </Button>
        </Form>
      </div>
 
       {comments.length === 0 ? (
         <Empty description={t('noComments')} />
       ) : (
         <List
           dataSource={comments}
           renderItem={(comment) => (
             <List.Item style={{ padding: 0, border: 'none' }}>
               {renderComment(comment)}
             </List.Item>
           )}
           style={{ background: 'transparent' }}
         />
       )}
     </div>
   );
 }
 
 export default CommentList;
