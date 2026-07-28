import os
import logging

os.environ["APP_ENV"] = "development"
os.environ["LOG_LEVEL"] = "ERROR"
logging.disable(logging.CRITICAL)

from fastapi.testclient import TestClient
from app.main import app
from app.dependencies import create_access_token

# user id 1 exists in dev.db
token = create_access_token(1)
headers = {"Authorization": f"Bearer {token}"}

with TestClient(app) as client:
    print("=== GET /api/user/profile ===")
    r = client.get("/api/user/profile", headers=headers)
    print(r.status_code, r.text[:1200])

    print("\n=== GET /api/user/comments ===")
    r = client.get("/api/user/comments?page=1&page_size=10", headers=headers)
    print(r.status_code, r.text[:1200])

    print("\n=== GET /api/user/articles ===")
    r = client.get("/api/user/articles?page=1&page_size=10", headers=headers)
    print(r.status_code, r.text[:1200])
