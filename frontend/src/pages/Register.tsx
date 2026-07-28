import { useState, useCallback, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  Space,
  Tabs,
  message,
} from 'antd';
import { useNavigate, Link } from 'react-router-dom';
import {
  UserOutlined,
  LockOutlined,
  MailOutlined,
  MobileOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../i18n';
import * as authApi from '../api/auth';

const { Title, Text } = Typography;

interface RegisterFormValues {
  username: string;
  email?: string;
  phone?: string;
  email_code?: string;
  phone_code?: string;
  password: string;
  confirmPassword: string;
}

function Register() {
  const navigate = useNavigate();
  const register = useAuthStore((state) => state.register);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [channel, setChannel] = useState<'email' | 'sms'>('email');
  const [sending, setSending] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [form] = Form.useForm<RegisterFormValues>();

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining((r) => (r <= 1 ? 0 : r - 1)), 1000);
    return () => clearInterval(id);
  }, [remaining]);

  const sendCode = useCallback(async () => {
    const values = form.getFieldsValue();
    let target = '';
    if (channel === 'email') {
      target = values.email?.trim() ?? '';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) {
        message.error(t('emailInvalid'));
        return;
      }
    } else {
      target = values.phone?.trim() ?? '';
      if (!/^1[3-9]\d{9}$/.test(target)) {
        message.error(t('phoneInvalid'));
        return;
      }
    }
    setSending(true);
    try {
      const res = await authApi.sendCode({ target, channel, purpose: 'register' });
      if (res?.success) {
        message.success(t('codeSent'));
        setDevCode(res.data?.dev_code ?? null);
        setRemaining(60);
        // Dev-only: surface the real gateway error (SMS or email) so a failed
        // send (bad template / credentials / unverified sender) is visible
        // instead of looking like a silent success.
        const sendErr = res.data?.send_error || res.data?.sms_error;
        if (sendErr) {
          message.warning(`验证码发送失败: ${sendErr}`);
        }
      } else {
        message.error(res?.message || t('sendFail'));
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : t('sendFail'));
    } finally {
      setSending(false);
    }
  }, [channel, form, t]);

  const handleSubmit = useCallback(
    async (values: RegisterFormValues) => {
      setLoading(true);
      setDevCode(null);
      try {
        const data: authApi.RegisterData = {
          username: values.username,
          password: values.password,
        };
        if (channel === 'email') {
          data.email = values.email;
          data.email_code = values.email_code;
        } else {
          data.phone = values.phone;
          data.phone_code = values.phone_code;
        }
        const msg = await register(data);
        message.success(msg);
        navigate('/', { replace: true });
      } catch (err: unknown) {
        message.error(err instanceof Error ? err.message : t('registerFail'));
      } finally {
        setLoading(false);
      }
    },
    [register, channel, navigate, t],
  );

  const switchChannel = (key: string) => {
    setChannel(key as 'email' | 'sms');
    setDevCode(null);
    // Clear the other channel's fields to avoid stale payloads.
    if (key === 'email') form.setFieldsValue({ phone: undefined, phone_code: undefined });
    else form.setFieldsValue({ email: undefined, email_code: undefined });
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Card style={{ width: '100%', maxWidth: 440, borderRadius: 8 }} styles={{ body: { padding: 32 } }}>
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <Title level={3} style={{ margin: 0 }}>{t('registerTitle')}</Title>
            <Text type="secondary">{t('createAccount')}</Text>
          </div>

          <Tabs
            activeKey={channel}
            onChange={switchChannel}
            centered
            items={[
              { key: 'email', label: t('registerViaEmail') },
              { key: 'sms', label: t('registerViaPhone') },
            ]}
          />

          <Form<RegisterFormValues>
            form={form}
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

            {channel === 'email' && (
              <>
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
                  name="email_code"
                  label={t('verificationCode')}
                  rules={[{ required: true, message: t('codeRequired') }]}
                >
                  <Input
                    prefix={<SafetyOutlined />}
                    placeholder={t('codePlaceholder')}
                    addonAfter={
                      <SendCodeButton
                        sending={sending}
                        remaining={remaining}
                        onSend={sendCode}
                        text={t('sendCode')}
                        sendingText={t('sending')}
                        resendText={t('resendIn')}
                      />
                    }
                  />
                </Form.Item>
              </>
            )}

            {channel === 'sms' && (
              <>
                <Form.Item
                  name="phone"
                  label={t('phone')}
                  rules={[
                    { required: true, message: t('pleaseEnterPhone') },
                    { pattern: /^1[3-9]\d{9}$/, message: t('phoneInvalid') },
                  ]}
                >
                  <Input prefix={<MobileOutlined />} placeholder={t('phonePlaceholder')} />
                </Form.Item>
                <Form.Item
                  name="phone_code"
                  label={t('verificationCode')}
                  rules={[{ required: true, message: t('codeRequired') }]}
                >
                  <Input
                    prefix={<SafetyOutlined />}
                    placeholder={t('codePlaceholder')}
                    addonAfter={
                      <SendCodeButton
                        sending={sending}
                        remaining={remaining}
                        onSend={sendCode}
                        text={t('sendCode')}
                        sendingText={t('sending')}
                        resendText={t('resendIn')}
                      />
                    }
                  />
                </Form.Item>
              </>
            )}

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

            {devCode && (
              <Text type="warning" style={{ display: 'block', marginBottom: 8 }}>
                {t('devCodeHint', { code: devCode })}
              </Text>
            )}

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

interface SendCodeButtonProps {
  sending: boolean;
  remaining: number;
  onSend: () => void;
  text: string;
  sendingText: string;
  resendText: string;
}

function SendCodeButton({
  sending,
  remaining,
  onSend,
  text,
  sendingText,
  resendText,
}: SendCodeButtonProps) {
  if (remaining > 0) {
    return (
      <Button type="link" size="small" disabled style={{ padding: 0 }}>
        {resendText.replace('{n}', String(remaining))}
      </Button>
    );
  }
  return (
    <Button type="link" size="small" loading={sending} onClick={onSend} style={{ padding: 0 }}>
      {sending ? sendingText : text}
    </Button>
  );
}

export default Register;
