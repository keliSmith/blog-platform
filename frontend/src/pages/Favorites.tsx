import { useState, useEffect, useCallback } from 'react';
import { Row, Col, Typography, Spin, Empty, Pagination } from 'antd';
import { useNavigate } from 'react-router-dom';
import { HeartOutlined } from '@ant-design/icons';
import { getMyFavorites } from '../api/user';
import type { Article } from '../types';
import ArticleCard from '../components/ArticleCard';
import { useTranslation } from '../i18n';

const { Title, Text } = Typography;

function Favorites() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  // 与首页一致，分页尺寸取 3 的倍数，保证卡片网格整齐（3 列）
  const pageSize = 9;

  const fetchFavorites = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await getMyFavorites({ page: p, page_size: pageSize });
      if (res.success && res.data) {
        setArticles(res.data.items);
        setTotal(res.data.pagination.total);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFavorites(1);
  }, [fetchFavorites]);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Title level={3} style={{ marginBottom: 16 }}>
        <HeartOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />
        {t('myFavorites')}
      </Title>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : articles.length === 0 ? (
        <Empty
          description={t('noFavorites')}
          style={{ padding: 60 }}
        >
          <Text type="secondary">
            {t('noFavoritesHint')}
          </Text>
        </Empty>
      ) : (
        <>
          <Row gutter={[24, 24]}>
            {articles.map((article) => (
              <Col xs={24} sm={12} md={8} key={article.id}>
                <ArticleCard
                  article={article}
                  onClick={() => navigate(`/articles/${article.slug}`)}
                />
              </Col>
            ))}
          </Row>
          {total > pageSize && (
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Pagination
                current={page}
                pageSize={pageSize}
                total={total}
                onChange={(p) => {
                  setPage(p);
                  fetchFavorites(p);
                }}
                showSizeChanger={false}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Favorites;
