import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Avatar,
  Upload,
  Badge,
  Typography,
  Space,
  message,
  Spin,
  Grid,
  Descriptions,
} from 'antd';
import {
  UserOutlined,
  EditOutlined,
  LockOutlined,
  CameraOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { getProfile, updateProfile, updatePassword } from '../api/user';
import { uploadAvatar } from '../api/upload';
import type { User } from '../types';
import { useTranslation } from '../i18n';

const { Title } = Typography;
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
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { user: authUser, setUser } = useAuthStore();
  const { t } = useTranslation();

  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchProfile();
    }
  }, [fetchProfile]);

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

  // Show a spinner until the initial profile load finishes. This early return
  // MUST come AFTER every hook declaration (useState/useCallback/useEffect),
  // otherwise the loading render skips hooks and React throws
  // "Rendered more hooks than during the previous render" — which previously
  // crashed the whole page.
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
              <Descriptions.Item label={t('phone')}>{profile?.phone || '-'}</Descriptions.Item>
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
    </div>
  );
}

export default Profile;
