import { useState, useEffect, useCallback, useRef } from 'react';
import { Row, Col, Card, Spin, Empty, Typography, Space, Tag, Grid, Input, Button, Tabs, Pagination, message } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FireOutlined,
  ClockCircleOutlined,
  SearchOutlined,
  SettingOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { Article, Category, Tag as TagType } from '../types';
import { getArticles, getArticle, type ArticleListParams } from '../api/articles';
import { getCategories } from '../api/categories';
import { getTags } from '../api/tags';
import { searchArticles } from '../api/search';
import { useAuthStore } from '../store/authStore';
import ArticleCard from '../components/ArticleCard';
import CategoryManagerModal from '../components/CategoryManagerModal';
import TagManagerModal from '../components/TagManagerModal';
import { useTranslation } from '../i18n';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;
const { CheckableTag } = Tag;

function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const { t } = useTranslation();

  const [articles, setArticles] = useState<Article[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'hot'>('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<TagType[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  // 文章网格每行列数固定为 3，分页尺寸取 3 的倍数保证整齐（3 x 3）
  const gridPageSize = 9;

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);

  // Inline search state (stays on the homepage, no separate search page)
  const [searchActive, setSearchActive] = useState(false);
  const [searchResults, setSearchResults] = useState<Article[] | null>(null);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [activeTagId, setActiveTagId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 复用分页文章列表接口：只查已发布文章
      // - 「所有文章」按时间（created_at）降序
      // - 「热门文章」按浏览量（热度）降序
      const listParams: Record<string, unknown> = {
        page,
        page_size: gridPageSize,
        status: 'published',
        sort: activeTab === 'hot' ? 'views' : 'latest',
      };
      const [listRes, catRes, tagRes] = await Promise.all([
        getArticles(listParams),
        getCategories(),
        getTags(),
      ]);
      if (listRes.success && listRes.data) {
        setArticles(listRes.data.items);
        setTotal(listRes.data.pagination.total);
      }
      if (catRes.success && catRes.data) setCategories(catRes.data);
      if (tagRes.success && tagRes.data) setTags(tagRes.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, activeTab, gridPageSize]);

  const handleTabChange = (key: string) => {
    setActiveTab(key as 'all' | 'hot');
    setPage(1);
  };

  // 当前 Tab 下的文章网格（含分页），「所有文章」与「热门文章」共用
  const renderGrid = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      );
    }
    if (articles.length === 0) {
      return <Empty description={t('noArticles')} style={{ padding: 40 }} />;
    }
    return (
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
        {total > gridPageSize && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Pagination
              current={page}
              pageSize={gridPageSize}
              total={total}
              onChange={(p) => setPage(p)}
              showSizeChanger={false}
            />
          </div>
        )}
      </>
    );
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // When arriving back at home with a refresh signal (e.g. from the article
  // detail "返回首页" button), re-fetch the latest articles once per signal.
  const lastRefreshRef = useRef<number | null>(null);
  useEffect(() => {
    const refresh = (location.state as { refresh?: number } | null)?.refresh;
    if (refresh && refresh !== lastRefreshRef.current) {
      lastRefreshRef.current = refresh;
      fetchData();
    }
  }, [location.state, fetchData]);

  // Run an inline search by keyword / article id / category / tag / title.
  const runSearch = useCallback(
    async (args: {
      keyword?: string;
      categoryId?: number | null;
      tagId?: number | null;
      page: number;
    }) => {
      const { keyword = '', categoryId = null, tagId = null, page } = args;
      const kw = (keyword ?? '').trim();
      setSearching(true);
      setSearchActive(true);
      try {
        // A bare numeric query with no filters is treated as an article id.
        const isIdSearch = /^\d+$/.test(kw) && !categoryId && !tagId;
        if (isIdSearch) {
          // A search-by-id only previews the article; it must not count as a
          // view (the real count happens when the user actually opens it).
          const res = await getArticle(Number(kw), { track_view: false });
          if (res.success && res.data) {
            setSearchResults([res.data]);
            setSearchTotal(1);
          } else {
            setSearchResults([]);
            setSearchTotal(0);
          }
        } else if (categoryId || tagId) {
          // 分类 / 标签筛选走文章列表接口（搜索接口仅支持标题 / 内容 / 作者模糊匹配）
          const params: ArticleListParams = {
            page,
            page_size: gridPageSize,
            status: 'published',
          };
          if (kw) params.keyword = kw;
          if (categoryId) params.category_id = categoryId;
          if (tagId) params.tag_id = tagId;
          const res = await getArticles(params);
          if (res.success && res.data) {
            setSearchResults(res.data.items);
            setSearchTotal(res.data.pagination.total);
          } else {
            setSearchResults([]);
            setSearchTotal(0);
          }
        } else {
          // 关键字搜索：标题 / 内容 / 作者名称 模糊匹配
          const params: Record<string, unknown> = { page, page_size: gridPageSize };
          if (kw) params.keyword = kw;
          const res = await searchArticles(params);
          if (res.success && res.data) {
            setSearchResults(res.data.items);
            setSearchTotal(res.data.pagination.total);
          } else {
            setSearchResults([]);
            setSearchTotal(0);
          }
        }
      } catch {
        setSearchResults([]);
        setSearchTotal(0);
      } finally {
        setSearching(false);
      }
    },
    [gridPageSize],
  );

  const handleSearch = (value: string) => {
    const kw = value.trim();
    // 未输入任何内容时不调用接口，提示用户输入关键字 / 标题等
    if (!kw) {
      message.warning(t('searchKeywordRequired'));
      return;
    }
    setSearchText(kw);
    setActiveCategoryId(null);
    setActiveTagId(null);
    setSearchPage(1);
    runSearch({ keyword: kw, categoryId: null, tagId: null, page: 1 });
  };

  const handleCategoryClick = (cat: Category) => {
    const next = activeCategoryId === cat.id ? null : cat.id;
    setActiveCategoryId(next);
    setSearchPage(1);
    runSearch({ keyword: searchText, categoryId: next, tagId: activeTagId, page: 1 });
  };

  const handleTagClick = (tag: TagType) => {
    const next = activeTagId === tag.id ? null : tag.id;
    setActiveTagId(next);
    setSearchPage(1);
    runSearch({ keyword: searchText, categoryId: activeCategoryId, tagId: next, page: 1 });
  };

  const clearSearch = () => {
    setSearchActive(false);
    setSearchResults(null);
    setSearchText('');
    setActiveCategoryId(null);
    setActiveTagId(null);
    setSearchPage(1);
  };

  const onSearchInputChange = (value: string) => {
    setSearchText(value);
    if (!value.trim() && !activeCategoryId && !activeTagId) {
      clearSearch();
    }
  };

  const hasActiveFilter = searchActive || !!activeCategoryId || !!activeTagId || !!searchText.trim();

  return (
    <div>
      {/* Hero Section */}
      {!isMobile && (
        <div
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: 12,
            padding: '48px 40px',
            marginBottom: 24,
            color: '#fff',
          }}
        >
          <Title level={2} style={{ color: '#fff', margin: 0 }}>
            {t('heroTitle')}
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, display: 'block', marginTop: 8 }}>
            {t('heroSubtitle')}
          </Text>
        </div>
      )}

      {/* Global Search + inline filters */}
      <Card
        style={{ marginBottom: 24, borderRadius: 8 }}
        styles={{ body: { padding: isMobile ? 12 : 16 } }}
        aria-label="global-article-search"
      >
        <Input.Search
          placeholder={t('searchPlaceholder')}
          allowClear
          enterButton={
            <>
              <SearchOutlined /> {t('search')}
            </>
          }
          size="large"
          value={searchText}
          onChange={(e) => onSearchInputChange(e.target.value)}
          onSearch={handleSearch}
        />

        {/* Category filter chips */}
        <div style={{ marginTop: 16 }}>
          <Space size={8} align="center" wrap>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {t('categories')}:
            </Text>
            {categories.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 13 }}>
                {t('noCategories')}
              </Text>
            ) : (
              categories.map((cat) => (
                <CheckableTag
                  key={cat.id}
                  checked={activeCategoryId === cat.id}
                  onChange={() => handleCategoryClick(cat)}
                  style={{ cursor: 'pointer', margin: 0 }}
                >
                  {cat.name}
                </CheckableTag>
              ))
            )}
            {isAdmin && (
              <Button type="link" size="small" icon={<SettingOutlined />} onClick={() => setCatModalOpen(true)}>
                {t('manage')}
              </Button>
            )}
          </Space>
        </div>

        {/* Tag filter chips */}
        <div style={{ marginTop: 12 }}>
          <Space size={8} align="center" wrap>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {t('tags')}:
            </Text>
            {tags.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 13 }}>
                {t('noTags')}
              </Text>
            ) : (
              tags.map((tag) => (
                <CheckableTag
                  key={tag.id}
                  checked={activeTagId === tag.id}
                  onChange={() => handleTagClick(tag)}
                  style={{ cursor: 'pointer', margin: 0 }}
                >
                  {tag.name}
                </CheckableTag>
              ))
            )}
            {isAdmin && (
              <Button type="link" size="small" icon={<SettingOutlined />} onClick={() => setTagModalOpen(true)}>
                {t('manage')}
              </Button>
            )}
          </Space>
        </div>

        {hasActiveFilter && (
          <Button
            type="link"
            icon={<CloseCircleOutlined />}
            onClick={clearSearch}
            style={{ paddingLeft: 0, marginTop: 12 }}
          >
            {t('clearFilters')}
          </Button>
        )}
      </Card>

      <Row gutter={[24, 24]}>
        {/* Main Content (full width so cards match「我的文章」3-per-row width) */}
        <Col xs={24}>
          {searchActive ? (
            <Card
              title={
                <Space>
                  <SearchOutlined />
                  <span>{`${t('searchResults')} (${searchTotal})`}</span>
                </Space>
              }
              style={{ borderRadius: 8 }}
              extra={
                <Button type="link" icon={<CloseCircleOutlined />} onClick={clearSearch}>
                  {t('clear')}
                </Button>
              }
              styles={{ body: { padding: isMobile ? 12 : 16 } }}
            >
              {searching ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <Spin size="large" />
                </div>
              ) : searchResults && searchResults.length > 0 ? (
                <>
                  <Row gutter={[24, 24]}>
                    {searchResults.map((article) => (
                      <Col xs={24} sm={12} md={8} key={article.id}>
                        <ArticleCard
                          article={article}
                          onClick={() => navigate(`/articles/${article.slug}`)}
                        />
                      </Col>
                    ))}
                  </Row>
                  {searchTotal > gridPageSize && (
                    <div style={{ textAlign: 'center', marginTop: 24 }}>
                      <Pagination
                        current={searchPage}
                        pageSize={gridPageSize}
                        total={searchTotal}
                        onChange={(p) => {
                          setSearchPage(p);
                          runSearch({
                            keyword: searchText,
                            categoryId: activeCategoryId,
                            tagId: activeTagId,
                            page: p,
                          });
                        }}
                        showSizeChanger={false}
                      />
                    </div>
                  )}
                </>
              ) : (
                <Empty description={t('noResults')} style={{ padding: 40 }} />
              )}
            </Card>
          ) : (
            <Tabs
              activeKey={activeTab}
              onChange={handleTabChange}
              items={[
                {
                  key: 'all',
                  label: (
                    <span>
                      <ClockCircleOutlined />
                      {t('tabAll')}
                    </span>
                  ),
                  children: renderGrid(),
                },
                {
                  key: 'hot',
                  label: (
                    <span>
                      <FireOutlined style={{ color: '#ff4d4f' }} />
                      {t('tabHot')}
                    </span>
                  ),
                  children: renderGrid(),
                },
              ]}
            />
          )}
        </Col>
      </Row>

      {/* Manager Modals (admin-only actions inside) */}
      <CategoryManagerModal
        open={catModalOpen}
        isAdmin={!!isAdmin}
        onClose={() => setCatModalOpen(false)}
        onChanged={fetchData}
        onSelect={(cat) => handleCategoryClick(cat)}
      />
      <TagManagerModal
        open={tagModalOpen}
        isAdmin={!!isAdmin}
        onClose={() => setTagModalOpen(false)}
        onChanged={fetchData}
        onSelect={(tag) => handleTagClick(tag)}
      />
    </div>
  );
}

export default Home;
