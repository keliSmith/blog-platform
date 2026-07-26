"""Test tag & category reorder (drag-and-drop persistence)."""

import pytest


@pytest.mark.anyio
async def test_reorder_tags_persists(client, auth_headers):
    """Reordering tags updates sort_order and the new order is returned on GET."""
    t1 = await client.post("/api/tags", json={"name": "Alpha"}, headers=auth_headers)
    t2 = await client.post("/api/tags", json={"name": "Beta"}, headers=auth_headers)
    t3 = await client.post("/api/tags", json={"name": "Gamma"}, headers=auth_headers)
    id1, id2, id3 = (
        t1.json()["data"]["id"],
        t2.json()["data"]["id"],
        t3.json()["data"]["id"],
    )

    # Reverse the order
    resp = await client.put(
        "/api/tags/reorder",
        json={"ordered_ids": [id3, id2, id1]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    listed = await client.get("/api/tags")
    items = listed.json()["data"]
    returned_ids = [i["id"] for i in items]
    assert returned_ids == [id3, id2, id1], returned_ids


@pytest.mark.anyio
async def test_reorder_categories_persists(client, auth_headers):
    """Reordering categories updates sort_order and the new order is returned."""
    c1 = await client.post("/api/categories", json={"name": "CatA"}, headers=auth_headers)
    c2 = await client.post("/api/categories", json={"name": "CatB"}, headers=auth_headers)
    c3 = await client.post("/api/categories", json={"name": "CatC"}, headers=auth_headers)
    id1, id2, id3 = (
        c1.json()["data"]["id"],
        c2.json()["data"]["id"],
        c3.json()["data"]["id"],
    )

    resp = await client.put(
        "/api/categories/reorder",
        json={"ordered_ids": [id3, id1, id2]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    listed = await client.get("/api/categories")
    items = listed.json()["data"]
    returned_ids = [i["id"] for i in items]
    assert returned_ids == [id3, id1, id2], returned_ids


@pytest.mark.anyio
async def test_reorder_requires_auth(client):
    """Reorder without a token is rejected with 401."""
    resp = await client.put("/api/tags/reorder", json={"ordered_ids": [1, 2, 3]})
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_reorder_unknown_ids_ignored(client, auth_headers):
    """Unknown ids in the list are ignored (idempotent), known ones reordered."""
    t1 = await client.post("/api/tags", json={"name": "X"}, headers=auth_headers)
    t2 = await client.post("/api/tags", json={"name": "Y"}, headers=auth_headers)
    id1, id2 = t1.json()["data"]["id"], t2.json()["data"]["id"]

    resp = await client.put(
        "/api/tags/reorder",
        json={"ordered_ids": [99999, id2, id1]},
        headers=auth_headers,
    )
    assert resp.status_code == 200

    listed = await client.get("/api/tags")
    returned_ids = [i["id"] for i in listed.json()["data"]]
    assert returned_ids == [id2, id1], returned_ids
