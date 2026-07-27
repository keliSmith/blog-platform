import { useState, useEffect, useCallback } from 'react';
import { Modal, List, Button, Form, Input, Space, message, Tag as AntTag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, HolderOutlined } from '@ant-design/icons';
import { getTags, createTag, updateTag, deleteTag, reorderTags } from '../api/tags';
import type { Tag, TagFormData } from '../types';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';

interface TagFormModalProps {
  open: boolean;
  editing: Tag | null;
  onClose: () => void;
  onSuccess: () => void;
}

function TagFormModal({ open, editing, onClose, onSuccess }: TagFormModalProps) {
  const [form] = Form.useForm<TagFormData>();
  const [submitting, setSubmitting] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (open) {
      if (editing) {
        form.setFieldsValue({
          name: editing.name,
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
      const res = editing ? await updateTag(editing.id, values) : await createTag(values);
      if (res.success) {
        message.success(editing ? t('msgTagUpdated') : t('msgTagCreated'));
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
      title={editing ? t('editTag') : t('addTag')}
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

interface TagManagerModalProps {
  open: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onChanged?: () => void;
  onSelect?: (tag: Tag) => void;
}

function TagManagerModal({ open, isAdmin, onClose, onChanged, onSelect }: TagManagerModalProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Tag | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTags();
      if (res.success && res.data) setTags(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);
  
  const persistOrder = useCallback(
    (ordered: Tag[]) => {
      const orderedIds = ordered.map((t) => t.id);
      setSavingOrder(true);
      reorderTags(orderedIds)
        .then((res) => {
          if (res.success) {
            message.success(t('reorderSaved'));
            onChanged?.();
          } else if (res.message) {
            message.error(res.message);
            fetchTags();
          }
        })
        .catch((e: unknown) => {
          message.error(e instanceof Error ? e.message : t('msgDeleteFailedGeneric'));
          fetchTags();
        })
        .finally(() => setSavingOrder(false));
    },
    [fetchTags, onChanged, t],
  );

  const handleDrop = (targetIndex: number) => {
    const from = dragIndex;
    setDragIndex(null);
    setOverIndex(null);
    if (from === null || from === targetIndex) return;
    const next = [...tags];
    const [moved] = next.splice(from, 1);
    next.splice(targetIndex, 0, moved);
    setTags(next);
    persistOrder(next);
  };

  useEffect(() => {
    if (open) fetchTags();
  }, [open, fetchTags]);

  const handleSelect = (tag: Tag) => {
    if (onSelect) {
      onSelect(tag);
      onClose();
      return;
    }
    navigate(`/search?q=${encodeURIComponent(tag.name)}`);
    onClose();
  };

  const handleAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleEdit = (tag: Tag) => {
    setEditing(tag);
    setFormOpen(true);
  };

  const handleDelete = (tag: Tag) => {
    Modal.confirm({
      title: t('deleteTagConfirmTitle', { name: tag.name }),
      content: t('deleteConfirmContent'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = await deleteTag(tag.id);
          if (res.success) {
            message.success(t('msgTagDeleted'));
            fetchTags();
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
        title={t('tagsTitle')}
        open={open}
        onCancel={onClose}
        footer={
          <Space>
            <Button onClick={onClose}>{t('close')}</Button>
            {isAdmin && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                {t('addTag')}
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
          dataSource={tags}
          locale={{ emptyText: t('noTags') }}
          split={false}
          renderItem={(tag, index) => {
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
                onClick={() => handleSelect(tag)}
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
                            handleEdit(tag);
                          }}
                        />,
                        <Button
                          key="del"
                          type="link"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(tag);
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
                    <AntTag color="blue" style={{ margin: 0 }}>
                      {tag.name}
                    </AntTag>
                  </Space>
                  <span style={{ color: '#999', fontSize: 12 }}>{tag.slug}</span>
                </Space>
              </List.Item>
            );
          }}
        />
      </Modal>

      <TagFormModal
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSuccess={() => {
          fetchTags();
          onChanged?.();
        }}
      />
    </>
  );
}

export default TagManagerModal;
