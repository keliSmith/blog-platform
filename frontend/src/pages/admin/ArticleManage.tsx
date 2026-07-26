import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Tag, Space, Modal, message, Spin } from 'antd';
import { EditOutlined, DeleteOutlined, UndoOutlined, CheckCircleOutlined, StopOutlined } from '@ant-design/icons';
import { getArticles, deleteArticle, restoreArticle, publishArticle, unpublishArticle } from '../../api/articles';
import type { Article } from '../../types';
import { useTranslation } from '../../i18n';

function ArticleManage() {
  const { t } = useTranslation();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const navigate = useNavigate();

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getArticles({ page, page_size: pageSize });
      if (res.success && res.data) {
        setArticles(res.data.items);
        setTotal(res.data.pagination.total);
      }
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : t('msgLoadArticlesFail'));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, t]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: t('deleteArticleConfirmTitle'),
      content: t('deleteArticleConfirmContent'),
      onOk: async () => {
        try {
          const res = await deleteArticle(id);
          if (res.success) {
            message.success(t('msgArticleDeleted'));
            fetchArticles();
          }
        } catch (e: unknown) {
          message.error(e instanceof Error ? e.message : t('msgDeleteFailed'));
        }
      },
    });
  };

  const handleRestore = async (id: number) => {
    try {
      const res = await restoreArticle(id);
      if (res.success) {
        message.success(t('msgArticleRestored'));
        fetchArticles();
      }
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : t('msgRestoreFailed'));
    }
  };

  const handlePublish = async (id: number) => {
    try {
      const res = await publishArticle(id);
      if (res.success) {
        message.success(t('msgArticlePublishedAdmin'));
        fetchArticles();
      }
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : t('msgPublishFailed'));
    }
  };

  const handleUnpublish = async (id: number) => {
    try {
      const res = await unpublishArticle(id);
      if (res.success) {
        message.success(t('msgArticleUnpublishedAdmin'));
        fetchArticles();
      }
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : t('msgUnpublishFailed'));
    }
  };

  const columns = [
    { title: t('colId'), dataIndex: 'id', key: 'id', width: 60 },
    { title: t('tableTitle'), dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: t('colAuthor'), key: 'author', width: 120,
      render: (_: unknown, record: Article) => record.author?.username || record.author_name || '-',
    },
    {
      title: t('colCategory'), key: 'category', width: 120,
      render: (_: unknown, record: Article) => record.category?.name || record.category_name || '-',
    },
    {
      title: t('colStatus'), dataIndex: 'status', key: 'status', width: 100,
      render: (status: string) => (
        <Tag color={status === 'published' ? 'green' : 'orange'}>
          {status === 'published' ? t('published') : t('draft')}
        </Tag>
      ),
    },
    { title: t('tableViews'), dataIndex: 'views', key: 'views', width: 80 },
    {
      title: t('colCreated'), dataIndex: 'created_at', key: 'created_at', width: 120,
      render: (date: string) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: t('colActions'), key: 'actions', width: 360,
      render: (_: unknown, record: Article) => (
        <Space wrap>
          <Button
            type="link"
            icon={<EditOutlined />}
           onClick={() => navigate('/edit/' + record.id)}
          >
            {t('edit')}
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            {t('delete')}
          </Button>
          <Button
            type="link"
            icon={<UndoOutlined />}
            onClick={() => handleRestore(record.id)}
          >
            {t('restore')}
          </Button>
          {record.status === 'draft' && (
            <Button
              type="link"
              icon={<CheckCircleOutlined />}
              onClick={() => handlePublish(record.id)}
            >
              {t('publish')}
            </Button>
          )}
          {record.status === 'published' && (
            <Button
              type="link"
              icon={<StopOutlined />}
              onClick={() => handleUnpublish(record.id)}
            >
              {t('unpublish')}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <div style={{ padding: 24 }}>
        <h2 style={{ marginBottom: 24 }}>{t('articleManagement')}</h2>
        <Table
          dataSource={articles}
          columns={columns}
          rowKey="id"
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
          }}
        />
      </div>
    </Spin>
  );
}

export default ArticleManage;
