"""Test article CRUD endpoints."""

import pytest


@pytest.mark.anyio
async def test_create_article(client, auth_headers):
    """Authenticated user can create an article."""
    resp = await client.post("/api/articles", json={
        "title": "My First Article",
        "content": "# Hello World\nThis is my first article.",
        "summary": "A short summary.",
        "status": "draft",
    }, headers=auth_headers)
    data = resp.json()
    assert resp.status_code == 200
    assert data["success"] is True
    assert "data" in data


@pytest.mark.anyio
async def test_list_articles(client):
    """Anyone can list published articles."""
    resp = await client.get("/api/articles")
    data = resp.json()
    assert resp.status_code == 200
    assert data["success"] is True
    assert "items" in data.get("data", {})


@pytest.mark.anyio
async def test_get_article_by_id_or_slug(client, sample_article):
    """Article can be fetched by slug or id."""
    slug = sample_article.get("slug", "test-article")
    resp = await client.get(f"/api/articles/{slug}")
    data = resp.json()
    assert resp.status_code == 200
    if data["success"]:
        assert data["data"]["title"] == "Test Article"


@pytest.mark.anyio
async def test_update_article(client, auth_headers, sample_article):
    """Author can update own article."""
    article_id = sample_article.get("id")
    resp = await client.put(f"/api/articles/{article_id}", json={
        "title": "Updated Title",
    }, headers=auth_headers)
    data = resp.json()
    assert resp.status_code == 200
    assert data["success"] is True


@pytest.mark.anyio
async def test_unpublish_article(client, auth_headers, sample_article):
    """Author can unpublish a published article -> becomes draft."""
    article_id = sample_article.get("id")
    resp = await client.put(
        f"/api/articles/{article_id}/unpublish", headers=auth_headers
    )
    data = resp.json()
    assert resp.status_code == 200
    assert data["success"] is True
    assert data["data"]["status"] == "draft"
    assert data["data"]["published_at"] is None


@pytest.mark.anyio
async def test_unpublish_missing_article_returns_404(client, auth_headers):
    """Unpublishing a non-existent article returns 404 (regression for #1)."""
    resp = await client.put("/api/articles/999999/unpublish", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_unpublish_preserves_tags(client, auth_headers):
    """Unpublishing an article with tags keeps the tags in the response.

    Regression guard for the serialize-after-flush pattern: the article is
    re-fetched after flush so the selectin ``tags`` relationship is loaded
    eagerly instead of relying on expired attributes.
    """
    await client.post("/api/tags", json={"name": "UnpubTag"}, headers=auth_headers)
    tags = (await client.get("/api/tags", headers=auth_headers)).json()["data"]
    tag_id = tags[0]["id"]

    created = await client.post(
        "/api/articles",
        json={"title": "Tagged", "content": "x", "status": "published", "tag_ids": [tag_id]},
        headers=auth_headers,
    )
    article_id = created.json()["data"]["id"]

    resp = await client.put(f"/api/articles/{article_id}/unpublish", headers=auth_headers)
    data = resp.json()
    assert resp.status_code == 200
    assert data["success"] is True
    assert data["data"]["status"] == "draft"
    assert data["data"]["published_at"] is None
    assert [t["id"] for t in data["data"]["tags"]] == [tag_id]



@pytest.mark.anyio
async def test_search_articles(client, sample_article):
    """Search endpoint returns a paginated envelope ({items, pagination})."""
    resp = await client.get("/api/search/articles?keyword=test")
    data = resp.json()
    assert resp.status_code == 200
    assert data["success"] is True
    # The endpoint must return the same paginated envelope as the list endpoint
    # (a dict with `items` + `pagination`), NOT a raw array. The frontend reads
    # data["items"] / data["pagination"]["total"].
    assert isinstance(data["data"], dict)
    assert isinstance(data["data"]["items"], list)
    assert data["data"]["items"]
    assert data["data"]["items"][0]["id"] == sample_article["id"]
    assert "pagination" in data["data"]
    assert data["data"]["pagination"]["total"] == len(data["data"]["items"])


@pytest.mark.anyio
async def test_get_article_statistics(client):
    """Statistics endpoint works."""
    resp = await client.get("/api/statistics/hot/articles")
    data = resp.json()
    assert resp.status_code == 200
    assert data["success"] is True
