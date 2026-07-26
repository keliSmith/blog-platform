import { useState, useCallback, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  Space,
  message,
  Modal,
} from 'antd';
import { useNavigate, Link } from 'react-router-dom';
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../i18n';
import * as authApi from '../api/auth';

const { Title, Text } = Typography;

interface LoginFormValues {
  username: string;
  password: string;
}

function detectChannel(target: string): authApi.Channel {
  return target.includes('@') ? 'email' : 'sms';
}

function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

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

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">
              {t('noAccount')} <Link to="/register">{t('registerNow')}</Link>
            </Text>
            <Link to="#" onClick={(e) => { e.preventDefault(); setForgotOpen(true); }}>
              {t('forgotPassword')}
            </Link>
          </div>
        </Space>
      </Card>

      <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </div>
  );
}

interface ForgotModalProps {
  open: boolean;
  onClose: () => void;
}

function ForgotPasswordModal({ open, onClose }: ForgotModalProps) {
  const resetPassword = useAuthStore((state) => state.resetPassword);
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [target, setTarget] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining((r) => (r <= 1 ? 0 : r - 1)), 1000);
    return () => clearInterval(id);
  }, [remaining]);

  // Reset internal state whenever the modal is (re)opened.
  useEffect(() => {
    if (open) {
      setStep(1);
      setTarget('');
      setCode('');
      setPassword('');
      setConfirm('');
      setRemaining(0);
      setDevCode(null);
    }
  }, [open]);

  const sendCode = useCallback(async () => {
    const channel = detectChannel(target.trim());
    if (channel === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target.trim())) {
      message.error(t('emailInvalid'));
      return;
    }
    if (channel === 'sms' && !/^1[3-9]\d{9}$/.test(target.trim())) {
      message.error(t('phoneInvalid'));
      return;
    }
    setSending(true);
    try {
      const res = await authApi.sendCode({ target: target.trim(), channel, purpose: 'reset' });
      if (res?.success) {
        message.success(t('codeSent'));
        setDevCode(res.data?.dev_code ?? null);
        setRemaining(60);
        setStep(2);
      } else {
        message.error(res?.message || t('sendFail'));
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : t('sendFail'));
    } finally {
      setSending(false);
    }
  }, [target, t]);

  const submitReset = useCallback(async () => {
    if (password.length < 6) {
      message.error(t('newPwdMin'));
      return;
    }
    if (password !== confirm) {
      message.error(t('pwdMismatch'));
      return;
    }
    const channel = detectChannel(target.trim());
    setSubmitting(true);
    try {
      const msg = await resetPassword({
        target: target.trim(),
        channel,
        code,
        new_password: password,
      });
      message.success(msg);
      onClose();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : t('resetFail'));
    } finally {
      setSubmitting(false);
    }
  }, [target, code, password, confirm, resetPassword, onClose, t]);

  return (
    <Modal
      open={open}
      title={t('forgotPasswordTitle')}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {step === 1 && (
          <>
            <Text type="secondary">{t('resetStep1Desc')}</Text>
            <Input
              size="large"
              prefix={<UserOutlined />}
              placeholder={t('emailOrPhone')}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
            <Button
              type="primary"
              block
              size="large"
              loading={sending}
              disabled={remaining > 0}
              onClick={sendCode}
            >
              {remaining > 0
                ? t('resendIn').replace('{n}', String(remaining))
                : t('sendResetCode')}
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <Text type="secondary">{t('resetPasswordTitle')}</Text>
            <Input
              size="large"
              prefix={<SafetyOutlined />}
              placeholder={t('codePlaceholder')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              addonAfter={
                remaining > 0 ? (
                  <Button type="link" size="small" disabled style={{ padding: 0 }}>
                    {t('resendIn').replace('{n}', String(remaining))}
                  </Button>
                ) : (
                  <Button type="link" size="small" loading={sending} onClick={sendCode} style={{ padding: 0 }}>
                    {t('sendCode')}
                  </Button>
                )
              }
            />
            <Input.Password
              size="large"
              prefix={<LockOutlined />}
              placeholder={t('newPassword')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input.Password
              size="large"
              prefix={<LockOutlined />}
              placeholder={t('confirmNewPassword')}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {devCode && (
              <Text type="warning">{t('devCodeHint', { code: devCode })}</Text>
            )}
            <Button type="primary" block size="large" loading={submitting} onClick={submitReset}>
              {t('resetPassword')}
            </Button>
            <Button type="link" block onClick={() => setStep(1)}>
              {t('backToLogin')}
            </Button>
          </>
        )}
      </Space>
    </Modal>
  );
}

export default Login;
