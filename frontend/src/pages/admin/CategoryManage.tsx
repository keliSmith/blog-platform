import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Spin } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../../api/categories';
import type { Category, CategoryFormData } from '../../types';
import { useTranslation } from '../../i18n';

interface CategoryModalProps {
  open: boolean;
  editingCategory: Category | null;
  onClose: () => void;
  onSuccess: () => void;
}

function CategoryModal({ open, editingCategory, onClose, onSuccess }: CategoryModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<CategoryFormData>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (editingCategory) {
        form.setFieldsValue({
          name: editingCategory.name,
          description: editingCategory.description || '',
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, editingCategory, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingCategory) {
        const res = await updateCategory(editingCategory.id, values);
        if (res.success) {
          message.success(t('msgCategoryUpdated'));
          onSuccess();
          onClose();
        }
      } else {
        const res = await createCategory(values);
        if (res.success) {
          message.success(t('msgCategoryCreated'));
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
      title={editingCategory ? t('editCategory') : t('addCategory')}
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
        <Form.Item name="description" label={t('description')}>
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function CategoryManage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCategories();
      if (res.success && res.data) {
        setCategories(res.data);
      }
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : t('msgLoadCategoriesFail'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleAdd = () => {
    setEditingCategory(null);
    setModalOpen(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setModalOpen(true);
  };

  const handleDelete = (category: Category) => {
    Modal.confirm({
      title: t('deleteCategoryConfirmTitle', { name: category.name }),
      content: t('deleteConfirmContent'),
      onOk: async () => {
        try {
          const res = await deleteCategory(category.id);
          if (res.success) {
            message.success(t('msgCategoryDeleted'));
            fetchCategories();
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
      render: (_: unknown, record: Category) => (
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
          <h2>{t('categoryManagement')}</h2>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>{t('addCategory')}</Button>
        </div>
        <Table
          dataSource={categories}
          columns={columns}
          rowKey="id"
          pagination={false}
        />
        <CategoryModal
          open={modalOpen}
          editingCategory={editingCategory}
          onClose={() => setModalOpen(false)}
          onSuccess={fetchCategories}
        />
      </div>
    </Spin>
  );
}

export default CategoryManage;
