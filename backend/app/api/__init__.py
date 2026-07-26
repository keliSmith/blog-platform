from app.api.admin import router as admin_router
from app.api.articles import router as articles_router
from app.api.auth import router as auth_router
from app.api.categories import router as categories_router
from app.api.comments import router as comments_router
from app.api.favorites import router as favorites_router
from app.api.likes import router as likes_router
from app.api.search import router as search_router
from app.api.statistics import router as statistics_router
from app.api.tags import router as tags_router
from app.api.upload import router as upload_router
from app.api.users import router as users_router


def register_routers():
    """Return all API routers for registration in main app."""
    return [
        # No prefix — auth routes at /api/register, /api/login
        auth_router,
        # /api prefix
        users_router,
        articles_router,
        categories_router,
        tags_router,
        comments_router,
        likes_router,
        favorites_router,
        search_router,
        statistics_router,
        upload_router,
        admin_router,
    ]
