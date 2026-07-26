import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Tag, Space, Select, Modal, message, Spin } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import request from '../../utils/request';
import { deleteComment } from '../../api/comments';
import type { Comment, ApiResponse, Pagination } from '../../types';
import { useTranslation } from '../../i18n';

interface AdminComment extends Comment {
  article_title?: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
};

function CommentManage() {
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { t } = useTranslation();

  const statusOptions = [
    { value: '', label: t('statusFilterAll') },
    { value: 'pending', label: t('statusPending') },
    { value: 'approved', label: t('statusApproved') },
    { value: 'rejected', label: t('statusRejected') },
  ];

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request.get<ApiResponse<{ items: AdminComment[]; pagination: Pagination }>>('/api/admin/comments', {
        params: {
          page,
          page_size: pageSize,
          ...(statusFilter ? { status: statusFilter } : {}),
        },
      });
      if (res.success) {
        if (res.data?.items) {
          setComments(res.data.items);
          setTotal(res.data.pagination?.total || res.data.items.length);
        } else if (Array.isArray(res.data)) {
          setComments(res.data);
          setTotal(res.data.length);
        }
      }
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : t('msgLoadCommentsFailAdmin'));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, t]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      const res = await request.put<ApiResponse<unknown>>(`/api/admin/comments/${id}/status`, { status });
      if (res.success) {
        const statusLabel =
          status === 'approved' ? t('statusApproved') : status === 'rejected' ? t('statusRejected') : t('statusPending');
        message.success(t('msgCommentStatus', { status: statusLabel }));
        fetchComments();
      }
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : t('msgUpdateFailed'));
    }
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: t('deleteCommentConfirmTitle'),
      content: t('deleteConfirmContent'),
      onOk: async () => {
        try {
          const res = await deleteComment(id);
          if (res.success) {
            message.success(t('msgCommentDeleted'));
            fetchComments();
          }
        } catch (e: unknown) {
          message.error(e instanceof Error ? e.message : t('msgDeleteFailedGeneric'));
        }
      },
    });
  };

  const columns = [
    { title: t('colId'), dataIndex: 'id', key: 'id', width: 60 },
    { title: t('colContent'), dataIndex: 'content', key: 'content', ellipsis: true },
    {
      title: t('colArticle'), dataIndex: 'article_title', key: 'article_title', width: 150, ellipsis: true,
      render: (title: string | undefined) => title || '-',
    },
    {
      title: t('colAuthor'), key: 'author', width: 120,
      render: (_: unknown, record: AdminComment) => record.user?.username || '-',
    },
    {
      title: t('tableStatus'), dataIndex: 'status', key: 'status', width: 100,
      render: (s: string) => s ? <Tag color={STATUS_COLORS[s] || 'default'}>{s}</Tag> : '-',
    },
    {
      title: t('colCreated'), dataIndex: 'created_at', key: 'created_at', width: 120,
      render: (date: string) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: t('colActions'), key: 'actions', width: 200,
      render: (_: unknown, record: AdminComment) => (
        <Space>
          {record.status === 'pending' && (
            <>
              <Button
                type="link"
                icon={<CheckCircleOutlined />}
                onClick={() => handleUpdateStatus(record.id, 'approved')}
              >
                {t('approve')}
              </Button>
              <Button
                type="link"
                icon={<CloseCircleOutlined />}
                onClick={() => handleUpdateStatus(record.id, 'rejected')}
              >
                {t('reject')}
              </Button>
            </>
          )}
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            {t('delete')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2>{t('commentManagement')}</h2>
          <Select
            style={{ width: 150 }}
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val);
              setPage(1);
            }}
            options={statusOptions}
          />
        </div>
        <Table
          dataSource={comments}
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

export default CommentManage;
