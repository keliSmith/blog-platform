import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Spin } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { getTags, createTag, updateTag, deleteTag } from '../../api/tags';
import type { Tag, TagFormData } from '../../types';
import { useTranslation } from '../../i18n';

interface TagModalProps {
  open: boolean;
  editingTag: Tag | null;
  onClose: () => void;
  onSuccess: () => void;
}

function TagModal({ open, editingTag, onClose, onSuccess }: TagModalProps) {
  const [form] = Form.useForm<TagFormData>();
  const [submitting, setSubmitting] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (open) {
      if (editingTag) {
        form.setFieldsValue({
          name: editingTag.name,
          slug: editingTag.slug,
          description: editingTag.description || '',
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, editingTag, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingTag) {
        const res = await updateTag(editingTag.id, values);
        if (res.success) {
          message.success(t('msgTagUpdated'));
          onSuccess();
          onClose();
        }
      } else {
        const res = await createTag(values);
        if (res.success) {
          message.success(t('msgTagCreated'));
          onSuccess();
          onClose();
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message) message.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={editingTag ? t('editTag') : t('addTag')}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={submitting}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label={t('name')}
          rules={[{ required: true, message: t('nameRequired') }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="slug"
          label={t('slug')}
          rules={[{ required: true, message: t('slugRequired') }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="description" label={t('description')}>
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function TagManage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const { t } = useTranslation();

  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTags();
      if (res.success && res.data) {
        setTags(res.data);
      }
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : t('msgLoadTagsFail'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const handleAdd = () => {
    setEditingTag(null);
    setModalOpen(true);
  };

  const handleEdit = (tag: Tag) => {
    setEditingTag(tag);
    setModalOpen(true);
  };

  const handleDelete = (tag: Tag) => {
    Modal.confirm({
      title: t('deleteTagConfirmTitle', { name: tag.name }),
      content: t('deleteConfirmContent'),
      onOk: async () => {
        try {
          const res = await deleteTag(tag.id);
          if (res.success) {
            message.success(t('msgTagDeleted'));
            fetchTags();
          }
        } catch (e: unknown) {
          message.error(e instanceof Error ? e.message : t('msgDeleteFailedGeneric'));
        }
      },
    });
  };

  const columns = [
    { title: t('colId'), dataIndex: 'id', key: 'id', width: 60 },
    { title: t('name'), dataIndex: 'name', key: 'name', width: 150 },
    { title: t('colSlug'), dataIndex: 'slug', key: 'slug', width: 150 },
    {
      title: t('colDescription'), dataIndex: 'description', key: 'description', ellipsis: true,
      render: (desc: string | undefined) => desc || '-',
    },
    {
      title: t('colCreated'), dataIndex: 'created_at', key: 'created_at', width: 120,
      render: (date: string) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: t('colActions'), key: 'actions', width: 160,
      render: (_: unknown, record: Tag) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>{t('edit')}</Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>{t('delete')}</Button>
        </Space>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2>{t('tagManagement')}</h2>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>{t('addTag')}</Button>
        </div>
        <Table
          dataSource={tags}
          columns={columns}
          rowKey="id"
          pagination={false}
        />
        <TagModal
          open={modalOpen}
          editingTag={editingTag}
          onClose={() => setModalOpen(false)}
          onSuccess={fetchTags}
        />
      </div>
    </Spin>
  );
}

export default TagManage;
