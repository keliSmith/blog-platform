import { useState, useEffect, useCallback } from 'react';
import { Modal, List, Button, Form, Input, Space, message, Tag as AntTag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, HolderOutlined } from '@ant-design/icons';
import { getCategories, createCategory, updateCategory, deleteCategory, reorderCategories } from '../api/categories';
import type { Category, CategoryFormData } from '../types';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';

interface CategoryFormModalProps {
  open: boolean;
  editing: Category | null;
  onClose: () => void;
  onSuccess: () => void;
}

function CategoryFormModal({ open, editing, onClose, onSuccess }: CategoryFormModalProps) {
  const [form] = Form.useForm<CategoryFormData>();
  const [submitting, setSubmitting] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (open) {
      if (editing) {
        form.setFieldsValue({
          name: editing.name,
          slug: editing.slug,
          description: editing.description || '',
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, editing, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const res = editing
        ? await updateCategory(editing.id, values)
        : await createCategory(values);
      if (res.success) {
        message.success(editing ? t('msgCategoryUpdated') : t('msgCategoryCreated'));
        onSuccess();
        onClose();
      } else if (res.message) {
        message.error(res.message);
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message) message.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={editing ? t('editCategory') : t('addCategory')}
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

interface CategoryManagerModalProps {
  open: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onChanged?: () => void;
  onSelect?: (cat: Category) => void;
}

function CategoryManagerModal({ open, isAdmin, onClose, onChanged, onSelect }: CategoryManagerModalProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCategories();
      if (res.success && res.data) setCategories(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const persistOrder = useCallback(
    (ordered: Category[]) => {
      const orderedIds = ordered.map((c) => c.id);
      setSavingOrder(true);
      reorderCategories(orderedIds)
        .then((res) => {
          if (res.success) {
            message.success(t('reorderSaved'));
            onChanged?.();
          } else if (res.message) {
            message.error(res.message);
            fetchCategories();
          }
        })
        .catch((e: unknown) => {
          message.error(e instanceof Error ? e.message : t('msgDeleteFailedGeneric'));
          fetchCategories();
        })
        .finally(() => setSavingOrder(false));
    },
    [fetchCategories, onChanged, t],
  );

  const handleDrop = (targetIndex: number) => {
    const from = dragIndex;
    setDragIndex(null);
    setOverIndex(null);
    if (from === null || from === targetIndex) return;
    const next = [...categories];
    const [moved] = next.splice(from, 1);
    next.splice(targetIndex, 0, moved);
    setCategories(next);
    persistOrder(next);
  };

  useEffect(() => {
    if (open) fetchCategories();
  }, [open, fetchCategories]);

  const handleSelect = (cat: Category) => {
    if (onSelect) {
      onSelect(cat);
      onClose();
      return;
    }
    navigate('/');
    onClose();
  };

  const handleAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleEdit = (cat: Category) => {
    setEditing(cat);
    setFormOpen(true);
  };

  const handleDelete = (cat: Category) => {
    Modal.confirm({
      title: t('deleteCategoryConfirmTitle', { name: cat.name }),
      content: t('deleteConfirmContent'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = await deleteCategory(cat.id);
          if (res.success) {
            message.success(t('msgCategoryDeleted'));
            fetchCategories();
            onChanged?.();
          } else if (res.message) {
            message.error(res.message);
          }
        } catch (e: unknown) {
          message.error(e instanceof Error ? e.message : t('msgDeleteFailedGeneric'));
        }
      },
    });
  };

  return (
    <>
      <Modal
        title={t('categoriesTitle')}
        open={open}
        onCancel={onClose}
        footer={
          <Space>
            <Button onClick={onClose}>{t('close')}</Button>
            {isAdmin && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                {t('addCategory')}
              </Button>
            )}
          </Space>
        }
        width={480}
      >
        {isAdmin && (
          <div style={{ marginBottom: 8, color: '#999', fontSize: 12 }}>
            {t('dragToReorder')}
          </div>
        )}
        <List
          loading={loading || savingOrder}
          dataSource={categories}
          locale={{ emptyText: t('noCategories') }}
          split={false}
          renderItem={(cat, index) => {
            const isDragging = dragIndex === index;
            const isOver = overIndex === index && dragIndex !== null && dragIndex !== index;
            return (
              <List.Item
                draggable={isAdmin}
                style={{
                  cursor: isAdmin ? 'grab' : 'pointer',
                  padding: '10px 4px',
                  borderRadius: 6,
                  opacity: isDragging ? 0.4 : 1,
                  background: isOver ? 'rgba(22, 119, 255, 0.08)' : undefined,
                  boxShadow: isOver ? 'inset 2px 0 0 #1677ff' : undefined,
                  transition: 'background 0.15s, opacity 0.15s',
                }}
                onClick={() => handleSelect(cat)}
                onDragStart={(e) => {
                  if (!isAdmin) return;
                  setDragIndex(index);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(index));
                }}
                onDragOver={(e) => {
                  if (!isAdmin) return;
                  e.preventDefault();
                  if (overIndex !== index) setOverIndex(index);
                }}
                onDrop={(e) => {
                  if (!isAdmin) return;
                  e.preventDefault();
                  handleDrop(index);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                actions={
                  isAdmin
                    ? [
                        <Button
                          key="edit"
                          type="link"
                          icon={<EditOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(cat);
                          }}
                        />,
                        <Button
                          key="del"
                          type="link"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(cat);
                          }}
                        />,
                      ]
                    : []
                }
              >
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space size={6}>
                    {isAdmin && (
                      <HolderOutlined style={{ color: '#bbb', cursor: 'grab' }} title={t('dragToReorder')} />
                    )}
                    <span>{cat.name}</span>
                  </Space>
                  <AntTag>{cat.slug}</AntTag>
                </Space>
              </List.Item>
            );
          }}
        />
      </Modal>

      <CategoryFormModal
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSuccess={() => {
          fetchCategories();
          onChanged?.();
        }}
      />
    </>
  );
}

export default CategoryManagerModal;
