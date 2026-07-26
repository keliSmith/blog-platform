import { useCallback } from 'react';
import { Card, Typography, Space, Image, Tag } from 'antd';
import type { ReactNode } from 'react';
import { EyeOutlined, HeartOutlined, UserOutlined, CalendarOutlined } from '@ant-design/icons';
import type { Article } from '../types';
import { useTranslation } from '../i18n';

const { Text, Paragraph } = Typography;

interface ArticleCardProps {
  article: Article;
  onClick?: () => void;
  /** 卡片底部展示状态标签（草稿 / 已发布），用于「我的文章」等管理场景 */
  showStatus?: boolean;
  /** 卡片底部操作区（如编辑 / 删除按钮），按需注入；点击不会触发卡片跳转 */
  actions?: ReactNode;
}

interface DisplayTag {
  id: number;
  name: string;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function ArticleCard({ article, onClick, showStatus, actions }: ArticleCardProps) {
  const { t } = useTranslation();
  const handleClick = useCallback(() => {
    onClick?.();
  }, [onClick]);

  // 点击操作区时不冒泡到卡片（避免误触跳转详情）
  const handleActionsClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // Tags to overlay on the cover. Prefer real tags, fall back to category.
  const displayTags: DisplayTag[] =
    article.tags && article.tags.length > 0
      ? article.tags.map((t) => ({ id: t.id, name: t.name }))
      : article.category_name
        ? [{ id: -1, name: article.category_name }]
        : [];

  // 增大封面尺寸，使卡片更贴近文章卡片的渲染效果
  const coverHeight = 220;

  return (
    <Card
      hoverable
      onClick={handleClick}
      style={{ marginBottom: 16, borderRadius: 12, overflow: 'hidden' }}
      styles={{ body: { padding: 20 } }}
    >
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        {/* Cover with semi-transparent tag overlay at the top-left */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: coverHeight,
            borderRadius: 8,
            overflow: 'hidden',
            backgroundColor: '#f0f0f0',
          }}
        >
          {article.cover_image ? (
            <Image
              src={article.cover_image}
              alt={article.title}
              width="100%"
              height={coverHeight}
              style={{ objectFit: 'cover', display: 'block' }}
              preview={false}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: 1,
              }}
            >
              {article.category_name || t('blog')}
            </div>
          )}

          {displayTags.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 10,
                left: 10,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                maxWidth: '90%',
              }}
            >
              {displayTags.map((tag) => (
                <span
                  key={tag.id}
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.55)',
                    color: '#fff',
                    padding: '3px 10px',
                    borderRadius: 4,
                    fontSize: 12,
                    lineHeight: '18px',
                    backdropFilter: 'blur(2px)',
                    WebkitBackdropFilter: 'blur(2px)',
                  }}
                >
                  #{tag.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 标题：单行省略，保证卡片高度一致 */}
        <Text
          strong
          ellipsis
          style={{ display: 'block', width: '100%', fontSize: 20, lineHeight: 1.4 }}
        >
          {article.title}
        </Text>

        {/* 摘要：单行省略；始终保留一行高度，避免有无摘要时卡片高度不一致 */}
        <Paragraph
          type="secondary"
          ellipsis
          style={{ marginBottom: 0, fontSize: 15, minHeight: 22, lineHeight: 1.5 }}
        >
          {article.summary || ' '}
        </Paragraph>

        <Space wrap size={[16, 8]}>
          <Text type="secondary" style={{ fontSize: 14 }}>
            <UserOutlined style={{ marginRight: 4 }} />
            {article.author_name || article.author?.username || t('anonymous')}
          </Text>

          <Text type="secondary" style={{ fontSize: 14 }}>
            <CalendarOutlined style={{ marginRight: 4 }} />
            {formatDate(article.published_at || article.created_at)}
          </Text>

          <Text type="secondary" style={{ fontSize: 14 }}>
            <EyeOutlined style={{ marginRight: 4 }} />
            {article.views}
          </Text>

          {article.likes !== undefined && (
            <Text type="secondary" style={{ fontSize: 14 }}>
              <HeartOutlined style={{ marginRight: 4 }} />
              {article.likes}
            </Text>
          )}
        </Space>

        {showStatus && (
          <Tag color={article.status === 'published' ? 'green' : 'orange'}>
            {article.status === 'published' ? t('published') : t('draft')}
          </Tag>
        )}

        {actions && (
          <div
            onClick={handleActionsClick}
            style={{
              borderTop: '1px solid #f0f0f0',
              paddingTop: 12,
              marginTop: 2,
            }}
          >
            {actions}
          </div>
        )}
      </Space>
    </Card>
  );
}

export default ArticleCard;
