import { useState, useCallback } from 'react';
import { Card, Form, Input, Button, Typography, Space, message } from 'antd';
import { useNavigate, Link } from 'react-router-dom';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../i18n';

const { Title, Text } = Typography;

interface LoginFormValues {
  username: string;
  password: string;
}

function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (values: LoginFormValues) => {
      setLoading(true);
      try {
        await login(values.username, values.password);
        message.success(t('loginSuccess'));
        navigate('/', { replace: true });
      } catch (err: unknown) {
        message.error(err instanceof Error ? err.message : t('loginFail'));
      } finally {
        setLoading(false);
      }
    },
    [login, navigate, t],
  );

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Card style={{ width: '100%', maxWidth: 400, borderRadius: 8 }} styles={{ body: { padding: 32 } }}>
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <Title level={3} style={{ margin: 0 }}>{t('loginTitle')}</Title>
            <Text type="secondary">{t('welcomeBack')}</Text>
          </div>

          <Form<LoginFormValues>
            onFinish={handleSubmit}
            layout="vertical"
            size="large"
            autoComplete="off"
          >
            <Form.Item
              name="username"
              label={t('username')}
              rules={[{ required: true, message: t('pleaseEnterUsername') }]}
            >
              <Input prefix={<UserOutlined />} placeholder={t('username')} />
            </Form.Item>

            <Form.Item
              name="password"
              label={t('password')}
              rules={[{ required: true, message: t('pleaseEnterPassword') }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder={t('password')} />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" loading={loading} block>
                {t('login')}
              </Button>
            </Form.Item>
          </Form>

          <div style={{ textAlign: 'center' }}>
            <Text type="secondary">
              {t('noAccount')} <Link to="/register">{t('registerNow')}</Link>
            </Text>
          </div>
        </Space>
      </Card>
    </div>
  );
}

export default Login;
