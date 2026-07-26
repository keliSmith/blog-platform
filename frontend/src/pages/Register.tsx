import { useState, useCallback } from 'react';
import { Card, Form, Input, Button, Typography, Space, message } from 'antd';
import { useNavigate, Link } from 'react-router-dom';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../i18n';

const { Title, Text } = Typography;

interface RegisterFormValues {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

function Register() {
  const navigate = useNavigate();
  const register = useAuthStore((state) => state.register);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (values: RegisterFormValues) => {
      setLoading(true);
      try {
        await register({
          username: values.username,
          email: values.email,
          password: values.password,
        });
        message.success(t('registerSuccess'));
        navigate('/', { replace: true });
      } catch (err: unknown) {
        message.error(err instanceof Error ? err.message : t('registerFail'));
      } finally {
        setLoading(false);
      }
    },
    [register, navigate, t],
  );

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Card style={{ width: '100%', maxWidth: 400, borderRadius: 8 }} styles={{ body: { padding: 32 } }}>
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <Title level={3} style={{ margin: 0 }}>{t('registerTitle')}</Title>
            <Text type="secondary">{t('createAccount')}</Text>
          </div>

          <Form<RegisterFormValues>
            onFinish={handleSubmit}
            layout="vertical"
            size="large"
            autoComplete="off"
          >
            <Form.Item
              name="username"
              label={t('username')}
              rules={[
                { required: true, message: t('pleaseEnterUsername') },
                { min: 3, message: t('usernameMin') },
              ]}
            >
              <Input prefix={<UserOutlined />} placeholder={t('username')} />
            </Form.Item>

            <Form.Item
              name="email"
              label={t('email')}
              rules={[
                { required: true, message: t('pleaseEnterEmail') },
                { type: 'email', message: t('emailInvalid') },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder={t('email')} />
            </Form.Item>

            <Form.Item
              name="password"
              label={t('password')}
              rules={[
                { required: true, message: t('pleaseEnterPassword') },
                { min: 6, message: t('newPwdMin') },
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder={t('password')} />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              label={t('confirmPassword')}
              dependencies={['password']}
              rules={[
                { required: true, message: t('pleaseConfirmPassword') },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error(t('pwdMismatchRegister')));
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder={t('confirmPassword')} />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" loading={loading} block>
                {t('register')}
              </Button>
            </Form.Item>
          </Form>

          <div style={{ textAlign: 'center' }}>
            <Text type="secondary">
              {t('haveAccount')} <Link to="/login">{t('loginNow')}</Link>
            </Text>
          </div>
        </Space>
      </Card>
    </div>
  );
}

export default Register;
