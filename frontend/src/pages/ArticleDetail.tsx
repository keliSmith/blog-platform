import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Skeleton,
  Result,
  Button,
  Typography,
  Space,
  Tag,
  Card,
  Avatar,
  message,
  Grid,
  Popconfirm,
  theme,
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
  EditOutlined,
  RollbackOutlined,
  LinkOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { getArticleBySlug, unpublishArticle } from '../api/articles';
import { likeArticle, unlikeArticle, getLikeInfo } from '../api/likes';
import { favoriteArticle, unfavoriteArticle, getFavoriteInfo } from '../api/favorites';
import type { Article } from '../types';
import { useAuthStore } from '../store/authStore';
import CommentList from '../components/CommentList';
import OutlinePanel from '../components/OutlinePanel';
import DOMPurify from 'dompurify';
import { renderMathInElement } from '../utils/mathRender';
import {
  extractOutline,
  countReadingMinutes,
  prependTitleToHtml,
} from '../utils/content';
import '../styles/prose.css';
import '../styles/articleDetail.css';
import 'katex/dist/katex.min.css';
import { useTranslation } from '../i18n';

const { Paragraph } = Typography;
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
  const { token } = theme.useToken();

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
  const commentsRef = useRef<HTMLDivElement>(null);

  // 语雀风格：标题即正文首个 h1。详情页直接展示正文（首个 h1 作为标题），
  // 不再单独渲染标题栏。若正文未以 h1 开头，则把后端 title 安全前置为 h1。
  const displayContent = useMemo(() => {
    if (!article?.content) return '';
    return prependTitleToHtml(article.title || '', article.content);
  }, [article?.title, article?.content]);

  // 目录大纲与阅读时长（均从正文推导）
  const outline = useMemo(() => extractOutline(displayContent), [displayContent]);
  const readingMinutes = useMemo(
    () => countReadingMinutes(displayContent),
    [displayContent],
  );

  // 阅读视图补全 KaTeX 公式渲染（编辑器以 data-latex 形式序列化公式）
  useEffect(() => {
    if (article?.content) {
      renderMathInElement(proseRef.current);
    }
  }, [article?.content]);

  // 阅读进度条 + 目录当前章节高亮（滚动驱动，rAF 节流）
  const [progress, setProgress] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);
  const tickingRef = useRef(false);

  useEffect(() => {
    const update = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? (el.scrollTop / max) * 100 : 0);
      const root = proseRef.current;
      if (root) {
        const heads = Array.from(
          root.querySelectorAll('h1, h2, h3'),
        ) as HTMLElement[];
        let idx = 0;
        for (let i = 0; i < heads.length; i++) {
          if (heads[i].getBoundingClientRect().top <= 100) idx = i;
          else break;
        }
        setActiveIdx(idx);
      }
      tickingRef.current = false;
    };
    const onScroll = () => {
      if (!tickingRef.current) {
        tickingRef.current = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => window.removeEventListener('scroll', onScroll);
  }, [displayContent]);

  const jumpToHeading = useCallback((idx: number) => {
    const root = proseRef.current;
    if (!root) return;
    const heads = root.querySelectorAll('h1, h2, h3');
    const target = heads[idx] as HTMLElement | undefined;
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleCopyLink = useCallback(() => {
    const url = window.location.href;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(() => message.success(t('linkCopied')))
        .catch(() => message.error(t('copyLink')));
    } else {
      message.info(url);
    }
  }, [t]);

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

  const authorName = article.author_name || article.author?.username || t('anonymous');
  const isHtmlContent = displayContent && /<[a-z][\s\S]*>/i.test(displayContent);

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: isMobile ? '8px 12px' : '16px 24px' }}>
      {/* 阅读进度条（顶部吸顶，超越语雀的沉浸阅读反馈） */}
      <div className="ad-progress" style={{ width: `${progress}%`, background: token.colorPrimary }} />

      <Space wrap style={{ marginBottom: 20 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
          style={{ padding: 0 }}
        >
          {t('back')}
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

      <div className="ad-layout">
        {/* 主阅读区 */}
        <div className="ad-main">
          {/* 顶部：作者信息栏 + 操作栏（语雀风格，与编辑页一致） */}
          <div className="ad-topbar">
            <div className="ad-author">
              <Avatar
                size={44}
                src={article.author?.avatar || undefined}
                icon={<UserOutlined />}
                style={{ background: token.colorPrimary, flex: 'none' }}
              />
              <div style={{ minWidth: 0 }}>
                <div className="ad-author__name">{authorName}</div>
                <div className="ad-author__meta">
                  <span>
                    <CalendarOutlined style={{ marginRight: 4 }} />
                    {formatDate(article.published_at || article.created_at)}
                  </span>
                  <span>
                    <EyeOutlined style={{ marginRight: 4 }} />
                    {`${article.views} ${t('views')}`}
                  </span>
                  <span>{t('readMinutes', { n: readingMinutes })}</span>
                </div>
                {(article.category_name || (article.tags && article.tags.length > 0)) && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {article.category_name && <Tag color="blue">{article.category_name}</Tag>}
                    {article.tags?.map((tag) => (
                      <Tag key={tag.id}>{tag.name}</Tag>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="ad-actionbar">
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
              <Button icon={<LinkOutlined />} onClick={handleCopyLink}>
                {t('copyLink')}
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
            </div>
          </div>

          <Card
            style={{ marginBottom: 32, borderRadius: 8, background: 'transparent', border: 'none', boxShadow: 'none' }}
            styles={{ body: { padding: isMobile ? 4 : 8 } }}
          >
            {isHtmlContent ? (
              <div
                ref={proseRef}
                className="article-prose"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(displayContent, { ADD_ATTR: ['style'] }),
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
                {displayContent}
              </Paragraph>
            )}
          </Card>

          <div ref={commentsRef}>
            <Card title={t('comments')} style={{ borderRadius: 8 }}>
              <CommentList articleId={article.id} />
            </Card>
          </div>
        </div>

        {/* 右侧大纲（语雀风格，与编辑/新增页统一） */}
        <OutlinePanel items={outline} activeIndex={activeIdx} onJump={jumpToHeading} />
      </div>

      {/* 移动端底部操作条（吸底，便于点赞/收藏/跳转评论） */}
      {isMobile && (
        <div className="ad-bottombar" style={{ background: token.colorBgContainer, borderTop: `1px solid ${token.colorBorder}` }}>
          <Button
            icon={liked ? <HeartFilled /> : <HeartOutlined />}
            onClick={handleLike}
            style={liked ? { color: token.colorPrimary } : undefined}
          >
            {likeCount > 0 ? likeCount : t('like')}
          </Button>
          <Button
            icon={favorited ? <StarFilled /> : <StarOutlined />}
            onClick={handleFavorite}
            style={favorited ? { color: '#faad14' } : undefined}
          >
            {favoriteCount > 0 ? favoriteCount : t('favorite')}
          </Button>
          <Button icon={<MessageOutlined />} onClick={() => commentsRef.current?.scrollIntoView({ behavior: 'smooth' })}>
            {t('comments')}
          </Button>
        </div>
      )}
    </div>
  );
}

export default ArticleDetail;
