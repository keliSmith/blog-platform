import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Avatar,
  Upload,
  Badge,
  Tabs,
  List,
  Typography,
  Space,
  message,
  Spin,
  Empty,
  Grid,
  Descriptions,
  Row,
  Col,
  Pagination,
} from 'antd';
import { UserOutlined, EditOutlined, LockOutlined, CameraOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getProfile, updateProfile, getMyComments, updatePassword } from '../api/user';
import { getMyArticles } from '../api/articles';
import { uploadAvatar } from '../api/upload';
import type { User, Article, Comment } from '../types';
import ArticleCard from '../components/ArticleCard';
import { useTranslation } from '../i18n';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function Profile() {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { user: authUser, setUser } = useAuthStore();
  const { t } = useTranslation();

  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [myArticles, setMyArticles] = useState<Article[]>([]);
  const [myComments, setMyComments] = useState<Comment[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [articlesPage, setArticlesPage] = useState(1);
  const [commentsPage, setCommentsPage] = useState(1);
  const [articlesTotal, setArticlesTotal] = useState(0);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const pageSize = 10;

  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const initialFetchDone = useRef(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getProfile();
      if (res.success && res.data) {
        setProfile(res.data);
        profileForm.setFieldsValue({
          username: res.data.username,
          email: res.data.email,
        });
      }
    } catch {
      message.error(t('loadProfileFail'));
    } finally {
      setLoading(false);
    }
  }, [profileForm, t]);

  const fetchMyArticles = useCallback(async (p: number) => {
    setArticlesLoading(true);
    try {
      const res = await getMyArticles({ page: p, page_size: pageSize });
      if (res.success && res.data) {
        setMyArticles(res.data.items);
        setArticlesTotal(res.data.pagination.total);
      }
    } catch {
      // ignore
    } finally {
      setArticlesLoading(false);
    }
  }, []);

  const fetchMyComments = useCallback(async (p: number) => {
    setCommentsLoading(true);
    try {
      const res = await getMyComments({ page: p, page_size: pageSize });
      if (res.success && res.data) {
        setMyComments(res.data.items);
        setCommentsTotal(res.data.pagination.total);
      }
    } catch {
      // ignore
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchProfile();
      fetchMyArticles(1);
      fetchMyComments(1);
    }
  }, [fetchProfile, fetchMyArticles, fetchMyComments]);

  const handleProfileSubmit = useCallback(
    async (values: { username: string; email: string }) => {
      setProfileSaving(true);
      try {
        const res = await updateProfile(values);
        if (res.success) {
          message.success(t('profileUpdated'));
          setUser(res.data || null);
          fetchProfile();
        }
      } catch (err: unknown) {
        message.error(err instanceof Error ? err.message : t('updateProfileFail'));
      } finally {
        setProfileSaving(false);
      }
    },
    [setUser, fetchProfile, t],
  );

  const handlePasswordSubmit = useCallback(
    async (values: { old_password: string; new_password: string; confirm_password: string }) => {
      if (values.new_password !== values.confirm_password) {
        message.error(t('pwdMismatch'));
        return;
      }
      setPasswordSaving(true);
      try {
        const res = await updatePassword({
          old_password: values.old_password,
          new_password: values.new_password,
        });
        if (res.success) {
          message.success(t('pwdUpdated'));
          passwordForm.resetFields();
        }
      } catch (err: unknown) {
        message.error(err instanceof Error ? err.message : t('updatePwdFail'));
      } finally {
        setPasswordSaving(false);
      }
    },
    [passwordForm, t],
  );

  const handleAvatarUpload = useCallback(
    async (file: File): Promise<false> => {
      try {
        const res = await uploadAvatar(file);
        if (res.success && res.data?.url) {
          message.success(t('avatarUpdated'));
          // 立即更新全局 auth 用户（导航栏头像）与本地 profile，保证上传后即时展示
          if (authUser) {
            setUser({ ...authUser, avatar: res.data.url });
          }
          fetchProfile();
        }
      } catch {
        message.error(t('avatarUploadFail'));
      }
      return false;
    },
    [authUser, setUser, fetchProfile, t],
  );

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Title level={3} style={{ marginBottom: 24 }}>{t('profileTitle')}</Title>

      {/* Profile Info */}
      <Card style={{ marginBottom: 24, borderRadius: 8 }}>
        <Space
          vertical={isMobile ? true : false}
          size={24}
          align={isMobile ? 'center' : 'start'}
          style={{ width: '100%' }}
        >
          <Upload
            name="avatar"
            showUploadList={false}
            beforeUpload={handleAvatarUpload}
            accept="image/*"
          >
            <Badge
              count={<CameraOutlined style={{ fontSize: 16, color: '#fff', background: '#1677ff', borderRadius: '50%', padding: 6 }} />}
              offset={[0, 0]}
            >
              <Avatar
                size={96}
                src={profile?.avatar}
                icon={<UserOutlined />}
                style={{ cursor: 'pointer', flexShrink: 0 }}
              />
            </Badge>
          </Upload>

          <div style={{ flex: 1, width: '100%' }}>
            <Descriptions column={isMobile ? 1 : 2} size="small">
              <Descriptions.Item label={t('username')}>{profile?.username || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('email')}>{profile?.email || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('role')}>{profile?.role || t('user')}</Descriptions.Item>
              <Descriptions.Item label={t('joined')}>
                {formatDate(profile?.created_at)}
              </Descriptions.Item>
            </Descriptions>
          </div>
        </Space>
      </Card>

      {/* Edit Profile Form */}
      <Card title={t('editProfile')} style={{ marginBottom: 24, borderRadius: 8 }}>
        <Form
          form={profileForm}
          layout="vertical"
          onFinish={handleProfileSubmit}
          style={{ maxWidth: 400 }}
        >
          <Form.Item
            name="username"
            label={t('username')}
            rules={[
              { required: true, message: t('pleaseEnterUsername') },
              { min: 3, message: t('usernameMin') },
            ]}
          >
            <Input prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item
            name="email"
            label={t('email')}
            rules={[
              { required: true, message: t('pleaseEnterEmail') },
              { type: 'email', message: t('emailInvalid') },
            ]}
          >
            <Input prefix={<EditOutlined />} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={profileSaving}>
              {t('saveChanges')}
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Change Password Form */}
      <Card title={t('changePassword')} style={{ marginBottom: 24, borderRadius: 8 }}>
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handlePasswordSubmit}
          style={{ maxWidth: 400 }}
        >
          <Form.Item
            name="old_password"
            label={t('currentPassword')}
            rules={[{ required: true, message: t('pleaseEnterCurrentPwd') }]}
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item
            name="new_password"
            label={t('newPassword')}
            rules={[
              { required: true, message: t('pleaseEnterNewPwd') },
              { min: 6, message: t('newPwdMin') },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label={t('confirmNewPassword')}
            dependencies={['new_password']}
            rules={[
              { required: true, message: t('pleaseConfirmNewPwd') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t('pwdMismatch')));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={passwordSaving}>
              {t('changePassword')}
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* My Articles & Comments */}
      {/* <Card style={{ marginTop: 24, borderRadius: 8 }}>
        <Tabs
          defaultActiveKey="articles"
          items={[
            {
              key: 'articles',
              label: t('myArticles'),
              children: (
                <div>
                  {articlesLoading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                      <Spin />
                    </div>
                  ) : myArticles.length === 0 ? (
                    <Empty description={t('noArticles')} />
                  ) : (
                    <Row gutter={[24, 24]}>
                      {myArticles.map((a) => (
                        <Col xs={24} sm={12} md={8} key={a.id}>
                          <ArticleCard
                            article={a}
                            showStatus
                            onClick={() => navigate(`/articles/${a.slug}`)}
                          />
                        </Col>
                      ))}
                    </Row>
                  )}
                  {articlesTotal > pageSize && (
                    <Pagination
                      current={articlesPage}
                      total={articlesTotal}
                      pageSize={pageSize}
                      onChange={(p) => {
                        setArticlesPage(p);
                        fetchMyArticles(p);
                      }}
                      style={{ marginTop: 24, textAlign: 'center' }}
                    />
                  )}
                </div>
              ),
            },
            {
              key: 'comments',
              label: t('myComments'),
              children: (
                <div>
                  {commentsLoading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                      <Spin />
                    </div>
                  ) : myComments.length === 0 ? (
                    <Empty description={t('noComments')} />
                  ) : (
                    <List
                      itemLayout="vertical"
                      dataSource={myComments}
                      renderItem={(c) => (
                        <List.Item key={c.id}>
                          <div style={{ marginBottom: 4 }}>
                            {c.article?.title && (
                              <Text strong>{c.article.title}</Text>
                            )}
                            <Text type="secondary" style={{ marginLeft: 8 }}>
                              {formatDate(c.created_at)}
                            </Text>
                          </div>
                          <div>{c.content}</div>
                        </List.Item>
                      )}
                    />
                  )}
                  {commentsTotal > pageSize && (
                    <Pagination
                      current={commentsPage}
                      total={commentsTotal}
                      pageSize={pageSize}
                      onChange={(p) => {
                        setCommentsPage(p);
                        fetchMyComments(p);
                      }}
                      style={{ marginTop: 24, textAlign: 'center' }}
                    />
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card> */}
    </div>
  );
}

export default Profile;
