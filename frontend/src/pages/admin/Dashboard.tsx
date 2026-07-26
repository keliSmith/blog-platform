import { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Table, Spin } from 'antd';
import { EyeOutlined, FileTextOutlined, CommentOutlined, UserOutlined } from '@ant-design/icons';
import { getArticles } from '../../api/articles';
import { getHotArticles, getHotToday, getHotWeek, getAdminStats } from '../../api/statistics';
import type { Article, StatisticsItem } from '../../types';
import { useTranslation } from '../../i18n';

interface DashboardStats {
  totalArticles: number;
  totalViews: number;
  totalComments: number;
  totalUsers: number;
}

function Dashboard() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalArticles: 0,
    totalViews: 0,
    totalComments: 0,
    totalUsers: 0,
  });
  const [hotArticles, setHotArticles] = useState<Article[]>([]);
  const [hotToday, setHotToday] = useState<StatisticsItem[]>([]);
  const [hotWeek, setHotWeek] = useState<StatisticsItem[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [articlesRes, hotRes, todayRes, weekRes, statsRes] = await Promise.all([
        getArticles({ page: 1, page_size: 100 }),
        getHotArticles(),
        getHotToday(),
        getHotWeek(),
        getAdminStats(),
      ]);

      if (articlesRes.success && articlesRes.data) {
        const allArticles = articlesRes.data.items;
        const totalViews = allArticles.reduce((sum, a) => sum + (a.views || 0), 0);
        setStats({
          totalArticles: articlesRes.data.pagination.total,
          totalViews,
          totalComments: 0,
          totalUsers: 0,
        });
      }

      if (statsRes.success && statsRes.data) {
        setStats({
          totalArticles: statsRes.data.total_articles || 0,
          totalViews: statsRes.data.total_views || 0,
          totalComments: statsRes.data.total_comments || 0,
          totalUsers: statsRes.data.total_users || 0,
        });
      }

      if (hotRes.success && hotRes.data) {
        setHotArticles(hotRes.data);
      }
      if (todayRes.success && todayRes.data) {
        setHotToday(todayRes.data);
      }
      if (weekRes.success && weekRes.data) {
        setHotWeek(weekRes.data);
      }
    } catch {
      // Silently handle errors; stats will remain at zero
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const hotArticleColumns = [
    { title: t('tableTitle'), dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: t('tableViews'), dataIndex: 'views', key: 'views', width: 100, sorter: (a: Article, b: Article) => a.views - b.views,
    },
    {
      title: t('tableStatus'), dataIndex: 'status', key: 'status', width: 100,
      render: (status: string) => status === 'published' ? t('published') : t('draft'),
    },
  ];

  const hotItemColumns = [
    { title: t('tableTitle'), dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: t('tableViews'), dataIndex: 'views', key: 'views', width: 100,
    },
  ];

  return (
    <Spin spinning={loading}>
      <div style={{ padding: 24 }}>
        <h2 style={{ marginBottom: 24 }}>{t('dashboard')}</h2>

        <Row gutter={[16, 16]}>
          <Col xs={12} sm={12} md={6}>
            <Card>
              <Statistic title={t('totalArticles')} value={stats.totalArticles} prefix={<FileTextOutlined />} />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card>
              <Statistic title={t('totalViews')} value={stats.totalViews} prefix={<EyeOutlined />} />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card>
              <Statistic title={t('totalComments')} value={stats.totalComments} prefix={<CommentOutlined />} />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card>
              <Statistic title={t('totalUsers')} value={stats.totalUsers} prefix={<UserOutlined />} />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          <Col xs={24} md={12}>
            <Card title={t('hotArticles')}>
              <Table
                dataSource={hotArticles}
                columns={hotArticleColumns}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title={t('hotToday')}>
              <Table
                dataSource={hotToday}
                columns={hotItemColumns}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} md={12}>
            <Card title={t('hotWeek')}>
              <Table
                dataSource={hotWeek}
                columns={hotItemColumns}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </Card>
          </Col>
        </Row>
      </div>
    </Spin>
  );
}

export default Dashboard;
