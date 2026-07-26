import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Skeleton,
  Result,
  Button,
  Typography,
  Space,
  Tag,
  Image,
  Card,
  message,
  Grid,
  Popconfirm,
} from 'antd';
import {
  HeartOutlined,
  HeartFilled,
  StarOutlined,
  StarFilled,
  EyeOutlined,
  UserOutlined,
  CalendarOutlined,
  ArrowLeftOutlined,
  HomeOutlined,
  EditOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import { getArticleBySlug, unpublishArticle } from '../api/articles';
import { likeArticle, unlikeArticle, getLikeInfo } from '../api/likes';
import { favoriteArticle, unfavoriteArticle, getFavoriteInfo } from '../api/favorites';
import type { Article } from '../types';
import { useAuthStore } from '../store/authStore';
import CommentList from '../components/CommentList';
import DOMPurify from 'dompurify';
import { renderMathInElement } from '../utils/mathRender';
import '../styles/prose.css';
import 'katex/dist/katex.min.css';
import { useTranslation } from '../i18n';

const { Title, Text, Paragraph } = Typography;
const { useBreakpoint } = Grid;

// Articles already viewed in this browser session. Used to skip re-counting
// the view when the same article is opened again (back/forward navigation,
// React StrictMode double-invoke, etc.) so the counter only increments once
// per article per session.
const viewedArticles = new Set<string>();

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function ArticleDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { user } = useAuthStore();
  const { t } = useTranslation();

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  const [favorited, setFavorited] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);

  // Tracks the slug currently being shown so a slow response for an old
  // article (e.g. fast back/forward navigation) can't overwrite the new one.
  const latestSlugRef = useRef<string | null>(null);

  const fetchArticle = useCallback(async () => {
    if (!slug) return;
    const currentSlug = slug;
    latestSlugRef.current = currentSlug;
    setLoading(true);
    setNotFound(false);
    try {
      // Only count this as a view the first time the article is opened in this
      // session. Re-opening it (back navigation, StrictMode double-invoke) passes
      // track_view=false so the read counter does not inflate. The backend also
      // de-duplicates per viewer, so this is defense-in-depth.
      const alreadyViewed = viewedArticles.has(currentSlug);
      const res = await getArticleBySlug(currentSlug, { track_view: !alreadyViewed });
      // A different article was opened while this request was in flight.
      if (latestSlugRef.current !== currentSlug) return;
      if (res.success && res.data) {
        const articleData = res.data;
        setArticle(articleData);
        // Seed like/favorite state from the detail payload. This works for
        // anonymous visitors without any extra (auth-requiring) requests.
        setLiked(articleData.liked || false);
        setLikeCount(articleData.like_count ?? 0);
        setFavorited(false);
        setFavoriteCount(0);

        if (!alreadyViewed) {
          viewedArticles.add(currentSlug);
        }
      } else {
        setNotFound(true);
      }
    } catch {
      if (latestSlugRef.current !== currentSlug) return;
      setNotFound(true);
    } finally {
      if (latestSlugRef.current === currentSlug) setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchArticle();
  }, [fetchArticle]);

  // Personal like/favorite state only exists for logged-in users. Fetching it
  // here (instead of inside fetchArticle, which used to depend on `user`) means
  // resolving auth no longer re-triggers the article detail request, which was
  // the cause of the detail query being called twice on a cold load.
  useEffect(() => {
    if (!user || !article?.id) return;
    let cancelled = false;
    getLikeInfo(article.id)
      .then((likeRes) => {
        if (cancelled) return;
        if (likeRes.success && likeRes.data) {
          setLiked(Boolean(likeRes.data.liked));
          setLikeCount(likeRes.data.like_count ?? 0);
        }
      })
      .catch(() => {});
    getFavoriteInfo(article.id)
      .then((favRes) => {
        if (cancelled) return;
        if (favRes.success && favRes.data) {
          setFavorited(favRes.data.favorited);
          setFavoriteCount(favRes.data.favorites ?? 0);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, article?.id]);

  const proseRef = useRef<HTMLDivElement>(null);

  // 阅读视图补全 KaTeX 公式渲染（编辑器以 data-latex 形式序列化公式）
  useEffect(() => {
    if (article?.content) {
      renderMathInElement(proseRef.current);
    }
  }, [article?.content]);

  const handleLike = useCallback(async () => {
    if (!article) return;
    const prevLiked = liked;
    const prevCount = likeCount;

    setLiked(!prevLiked);
    setLikeCount(prevLiked ? prevCount - 1 : prevCount + 1);

    try {
      if (prevLiked) {
        const res = await unlikeArticle(article.id);
        if (res.success && res.data) {
          setLiked(res.data.liked);
          setLikeCount(res.data.like_count);
        }
      } else {
        const res = await likeArticle(article.id);
        if (res.success && res.data) {
          setLiked(res.data.liked);
          setLikeCount(res.data.like_count);
        }
      }
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
      message.error('Like action failed');
    }
  }, [article, liked, likeCount]);

  const handleFavorite = useCallback(async () => {
    if (!article) return;
    const prevFavorited = favorited;
    const prevCount = favoriteCount;

    setFavorited(!prevFavorited);
    setFavoriteCount(prevFavorited ? prevCount - 1 : prevCount + 1);

    try {
      if (prevFavorited) {
        const res = await unfavoriteArticle(article.id);
        if (res.success && res.data) {
          setFavoriteCount(res.data.favorites);
        }
      } else {
        const res = await favoriteArticle(article.id);
        if (res.success && res.data) {
          setFavoriteCount(res.data.favorites);
        }
      }
    } catch {
      setFavorited(prevFavorited);
      setFavoriteCount(prevCount);
      message.error('Favorite action failed');
    }
  }, [article, favorited, favoriteCount]);

  const handleUnpublish = useCallback(async () => {
    if (!article) return;
    try {
      const res = await unpublishArticle(article.id);
      if (res.success) {
        message.success(t('msgUnpublishSuccess'));
        setArticle({ ...article, status: 'draft', published_at: undefined });
      } else if (res.message) {
        message.error(res.message);
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : t('unpublishFailed'));
    }
  }, [article, t]);

  if (loading) {
    return (
      <div style={{ padding: isMobile ? 0 : 16 }}>
        <Skeleton active avatar paragraph={{ rows: 8 }} />
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <Result
        status="404"
        title="Article Not Found"
        subTitle="The article you're looking for doesn't exist or has been removed."
        extra={
          <Button type="primary" onClick={() => navigate('/', { state: { refresh: Date.now() } })}>
            {t('backToHome')}
          </Button>
        }
      />
    );
  }

  // 仅文章作者本人可编辑（与后端更新权限一致）
  const canEdit = !!user && !!article.author?.id && user.id === article.author.id;
  // 作者本人对已发布文章可取消发布
  const canUnpublish = canEdit && article.status === 'published';

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Space wrap style={{ marginBottom: 16 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
          style={{ padding: 0 }}
        >
          {t('back')}
        </Button>
        <Button
          type="text"
          icon={<HomeOutlined />}
          onClick={() => navigate('/', { state: { refresh: Date.now() } })}
          style={{ padding: 0 }}
        >
          {t('backHome')}
        </Button>
        {canEdit && (
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => navigate(`/edit/${article.id}`)}
            style={{ paddingLeft: 12, paddingRight: 12 }}
          >
            {t('edit')}
          </Button>
        )}
      </Space>

      <Title level={2} style={{ marginBottom: 16 }}>
        {article.title}
      </Title>

      <Space wrap size={[16, 8]} style={{ marginBottom: 24 }}>
        <Text type="secondary">
          <UserOutlined style={{ marginRight: 4 }} />
          {article.author_name || article.author?.username || t('anonymous')}
        </Text>
        <Text type="secondary">
          <CalendarOutlined style={{ marginRight: 4 }} />
          {formatDate(article.published_at || article.created_at)}
        </Text>
        <Text type="secondary">
          <EyeOutlined style={{ marginRight: 4 }} />
          {`${article.views} ${t('views')}`}
        </Text>
        {article.category_name && (
          <Tag color="blue">{article.category_name}</Tag>
        )}
        {article.tags?.map((tag) => (
          <Tag key={tag.id}>{tag.name}</Tag>
        ))}
      </Space>

      <Card
        size="small"
        style={{ marginBottom: 24, borderRadius: 8 }}
        styles={{ body: { padding: '12px 16px' } }}
      >
        <Space wrap>
          <Button
            type={liked ? 'primary' : 'default'}
            icon={liked ? <HeartFilled /> : <HeartOutlined />}
            onClick={handleLike}
          >
            {liked ? t('liked') : t('like')} {likeCount > 0 && `(${likeCount})`}
          </Button>
          <Button
            icon={favorited ? <StarFilled /> : <StarOutlined />}
            onClick={handleFavorite}
            style={favorited ? { color: '#faad14', borderColor: '#faad14' } : undefined}
          >
            {favorited ? t('favorited') : t('favorite')} {favoriteCount > 0 && `(${favoriteCount})`}
          </Button>
          {canUnpublish && (
            <Popconfirm
              title={t('confirmUnpublishTitle')}
              description={t('confirmUnpublishDesc')}
              okText={t('unpublish')}
              cancelText={t('cancel')}
              okButtonProps={{ danger: true }}
              onConfirm={handleUnpublish}
            >
              <Button icon={<RollbackOutlined />}>{t('unpublish')}</Button>
            </Popconfirm>
          )}
          <Text type="secondary">
            {article.status === 'published' ? t('published') : t('draft')}
          </Text>
        </Space>
      </Card>

      <Card
        style={{ marginBottom: 32, borderRadius: 8 }}
        styles={{
          body: {
            padding: isMobile ? 16 : 24,
            maxHeight: 'calc(100vh - 220px)',
            overflowY: 'auto',
          },
        }}
      >
        {article.content && /<[a-z][\s\S]*>/i.test(article.content) ? (
          <div
            ref={proseRef}
            className="article-prose"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(article.content, { ADD_ATTR: ['style'] }),
            }}
          />
        ) : (
          <Paragraph
            style={{
              fontSize: 16,
              lineHeight: 1.8,
              whiteSpace: 'pre-wrap',
              margin: 0,
            }}
          >
            {article.content}
          </Paragraph>
        )}
      </Card>

      <Card title={t('comments')} style={{ borderRadius: 8 }}>
        <CommentList articleId={article.id} />
      </Card>
    </div>
  );
}

export default ArticleDetail;
