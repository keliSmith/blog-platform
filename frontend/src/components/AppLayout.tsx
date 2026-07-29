import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { Layout, Button, Dropdown, Avatar, Space, Grid, Typography, Tooltip, theme } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { useTranslation } from '../i18n';
import type { MenuProps } from 'antd';
import {
  HomeOutlined,
  UserOutlined,
  SunOutlined,
  MoonOutlined,
  LogoutOutlined,
  LoginOutlined,
  MenuOutlined,
  FileTextOutlined,
} from '@ant-design/icons';

const { Header, Content, Footer } = Layout;
const { useBreakpoint } = Grid;
const { Text } = Typography;

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, logout } = useAuthStore();
  const { theme: themeMode, lang, toggleTheme, setLang } = useThemeStore();
  const screens = useBreakpoint();
  const { token: themeToken } = theme.useToken();  // ✅ 使用 theme.useToken()
  const isMobile = !screens.md;
  const { t } = useTranslation();

  const toggleLang = useCallback(() => {
    setLang(lang === 'zh' ? 'en' : 'zh');
  }, [lang, setLang]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/');
  }, [logout, navigate]);

  const userMenuItems: MenuProps['items'] = useMemo(
    () => [
      {
        key: 'profile',
        icon: <UserOutlined />,
        label: t('profile'),
        onClick: () => navigate('/profile'),
      },
      { type: 'divider' },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: t('logout'),
        onClick: handleLogout,
      },
    ],
    [navigate, handleLogout, t],
  );

  const navItems: MenuProps['items'] = useMemo(
    () => [
      { key: '/', icon: <HomeOutlined />, label: t('home'), onClick: () => navigate('/') },
      {
        key: '/my-articles',
        icon: <FileTextOutlined />,
        label: t('myArticles'),
        onClick: () => navigate('/my-articles'),
      },
    ],
    [t, navigate],
  );

  const selectedKey = useMemo(() => {
    const matched = navItems
      .map((item) => item!.key as string)
      .filter((key) => location.pathname === key || location.pathname.startsWith(key + '/'))
      .sort((a, b) => b.length - a.length);
    return matched[0] || '';
  }, [location.pathname, navItems]);

  const renderRightSection = () => {
    if (isMobile) {
      const mobileItems: MenuProps['items'] = [
        ...navItems,
        { type: 'divider' as const },
        {
          key: 'theme',
          icon: themeMode === 'dark' ? <SunOutlined /> : <MoonOutlined />,
          label: t(themeMode === 'dark' ? 'light' : 'dark'),
          onClick: toggleTheme,
        },
        {
          key: 'lang',
          label: t('switchLang'),
          onClick: toggleLang,
        },
        { type: 'divider' as const },
        ...(token && user
          ? [
              { key: 'profile', icon: <UserOutlined />, label: t('profile'), onClick: () => navigate('/profile') },
              { type: 'divider' as const },
              { key: 'logout', icon: <LogoutOutlined />, label: t('logout'), onClick: handleLogout },
            ]
          : [{ key: 'login', icon: <LoginOutlined />, label: t('login'), onClick: () => navigate('/login') }]),
      ];
      return (
        <Dropdown menu={{ items: mobileItems }} trigger={['click']}>
          <Button type="text" icon={<MenuOutlined />} />
        </Dropdown>
      );
    }

    if (token && user) {
      return (
        <Dropdown menu={{ items: userMenuItems }}>
          <Space style={{ cursor: 'pointer' }}>
            <Avatar src={user.avatar || undefined} icon={<UserOutlined />} />
            <Text>{user.username}</Text>
          </Space>
        </Dropdown>
      );
    }

    return (
      <Button type="primary" icon={<LoginOutlined />} onClick={() => navigate('/login')}>
        {t('login')}
      </Button>
    );
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '0 12px' : '0 24px',
          background: themeToken.colorBgContainer,
          borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
          position: 'sticky',
          top: 0,
          zIndex: 100,
          height: 56,
          lineHeight: '56px',
        }}
      >
        <Space>
          {isMobile && (
            <Button
              type="text"
              icon={<HomeOutlined style={{ fontSize: 20 }} />}
              aria-label="Home"
              style={{ display: 'flex', alignItems: 'center' }}
              onClick={() => navigate('/', { state: { refresh: Date.now() } })}
            />
          )}
          
          {!isMobile &&
            navItems.map((item) => {
              const it = item as unknown as { key: string; icon?: ReactNode; label?: ReactNode };
              return (
                <Button
                  key={it.key}
                  type={selectedKey === it.key ? 'primary' : 'text'}
                  icon={it.icon}
                  style={{ marginLeft: 8 }}
                  onClick={() => navigate(it.key)}
                >
                  {it.label as string}
                </Button>
              );
            })}
        </Space>
        <Space>
          {!isMobile && (
            <>
              <Tooltip title={t(themeMode === 'dark' ? 'light' : 'dark')}>
                <Button
                  type="text"
                  icon={themeMode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
                  onClick={toggleTheme}
                />
              </Tooltip>
              <Tooltip title={t('langTooltip')}>
                <Button type="text" onClick={toggleLang}>
                  {t('switchLang')}
                </Button>
              </Tooltip>
            </>
          )}
          {renderRightSection()}
        </Space>
      </Header>

      <Content
        style={{
          padding: isMobile ? '12px' : '24px',
          maxWidth: 1200,
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        <Outlet />
      </Content>

      <Footer style={{ textAlign: 'center', color: themeToken.colorTextTertiary }}>
        Blog Platform &copy;{new Date().getFullYear()}
      </Footer>
    </Layout>
  );
}

export default AppLayout;