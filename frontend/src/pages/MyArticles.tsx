import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Spin,
  Empty,
  Typography,
  Space,
  Button,
  Pagination,
  Segmented,
  Popconfirm,
  message,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  SendOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import type { Article } from '../types';
import { getMyArticles, deleteArticle, publishArticle, unpublishArticle } from '../api/articles';
import ArticleCard from '../components/ArticleCard';
import { useTranslation } from '../i18n';

const { Title } = Typography;

type StatusFilter = 'all' | 'published' | 'draft';

function MyArticles() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  // 与首页一致，使用 3 的倍数的分页尺寸，保证卡片网格整齐
  const pageSize = 9;

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, page_size: pageSize };
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await getMyArticles(params);
      if (res.success && res.data) {
        setArticles(res.data.items);
        setTotal(res.data.pagination.total);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handleDelete = useCallback(
    async (article: Article) => {
      try {
        const res = await deleteArticle(article.id);
        if (res.success) {
          message.success(t('msgArticleDeleted'));
          fetchArticles();
        } else if (res.message) {
          message.error(res.message);
        }
      } catch (err: unknown) {
        message.error(err instanceof Error ? err.message : t('deleteFailed'));
      }
    },
    [fetchArticles, t],
  );

  const handlePublish = useCallback(
    async (article: Article) => {
      try {
        const res = await publishArticle(article.id);
        if (res.success) {
          message.success(t('msgArticlePublished'));
          fetchArticles();
        } else if (res.message) {
          message.error(res.message);
        }
      } catch (err: unknown) {
        message.error(err instanceof Error ? err.message : t('publishFailed'));
      }
    },
    [fetchArticles, t],
  );

  const handleUnpublish = useCallback(
    async (article: Article) => {
      try {
        const res = await unpublishArticle(article.id);
        if (res.success) {
          message.success(t('msgArticleUnpublished'));
          fetchArticles();
        } else if (res.message) {
          message.error(res.message);
        }
      } catch (err: unknown) {
        message.error(err instanceof Error ? err.message : t('unpublishFailed'));
      }
    },
    [fetchArticles, t],
  );

  const renderActions = (article: Article) => (
    <Space size={4} wrap>
      {article.status === 'draft' && (
        <Button
          type="link"
          size="small"
          icon={<SendOutlined />}
          onClick={() => handlePublish(article)}
        >
          {t('publish')}
        </Button>
      )}
      {article.status === 'published' && (
        <Popconfirm
          title={t('confirmUnpublishTitle')}
          description={t('confirmUnpublishDesc')}
          okText={t('unpublish')}
          cancelText={t('cancel')}
          okButtonProps={{ danger: true }}
          onConfirm={() => handleUnpublish(article)}
        >
          <Button type="link" size="small" icon={<RollbackOutlined />}>
            {t('unpublish')}
          </Button>
        </Popconfirm>
      )}
      <Button
        type="link"
        size="small"
        icon={<EditOutlined />}
        onClick={() => navigate(`/edit/${article.id}`)}
      >
        {t('edit')}
      </Button>
      <Popconfirm
        title={t('confirmDeleteTitle')}
        description={t('confirmDeleteDesc')}
        okText={t('delete')}
        cancelText={t('cancel')}
        okButtonProps={{ danger: true }}
        onConfirm={() => handleDelete(article)}
      >
        <Button type="link" size="small" danger icon={<DeleteOutlined />}>
          {t('delete')}
        </Button>
      </Popconfirm>
    </Space>
  );

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          {t('myArticlesTitle')}
        </Title>
        <Space wrap>
          <Segmented<StatusFilter>
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
            options={[
              { label: t('filterAll'), value: 'all' },
              { label: t('filterPublished'), value: 'published' },
              { label: t('filterDraft'), value: 'draft' },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/write')}>
            {t('writeArticle')}
          </Button>
        </Space>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : articles.length === 0 ? (
        <Empty description={t('noArticlesYet')} style={{ padding: 60 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/write')}>
            {t('writeFirst')}
          </Button>
        </Empty>
      ) : (
        <Row gutter={[24, 24]}>
          {articles.map((article) => (
            <Col xs={24} sm={12} md={8} key={article.id}>
              <ArticleCard
                article={article}
                showStatus
                actions={renderActions(article)}
                onClick={() => navigate(`/articles/${article.slug}`)}
              />
            </Col>
          ))}
        </Row>
      )}

      {total > pageSize && (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            onChange={(p) => setPage(p)}
            showSizeChanger={false}
          />
        </div>
      )}
    </div>
  );
}

export default MyArticles;
