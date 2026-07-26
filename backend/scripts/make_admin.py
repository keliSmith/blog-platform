"""Create or promote an admin user for the blog platform.

Usage (run from the backend/ directory, with the .venv active):

    python scripts/make_admin.py <username> <email> <password>

Behavior:
- If a user with the given username OR email already exists, it is promoted
  to role='admin' (idempotent — safe to run repeatedly).
- Otherwise a brand-new user with role='admin' is created.

The password is hashed with the exact same bcrypt routine the API uses
(app.dependencies.hash_password), so the account can log in normally.

Environment:
- Connects to the database resolved by app.config.settings (dev -> dev.db,
  testing -> test.db, production/MySQL via DATABASE_URL or MYSQL_* in .env).
- To target a different database, set APP_ENV / DATABASE_URL before running,
  e.g.  APP_ENV=testing python scripts/make_admin.py admin a@b.c pass
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# Make the backend package root importable when run as a standalone script
# (python scripts/make_admin.py ...), where sys.path[0] would otherwise be
# the scripts/ directory instead of the project root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select

from app.database import async_session_factory
from app.dependencies import hash_password
from app.models.user import User


async def main(username: str, email: str, password: str) -> None:
    async with async_session_factory() as session:
        result = await session.execute(
            select(User).where((User.username == username) | (User.email == email))
        )
        user = result.scalar_one_or_none()

        if user is None:
            user = User(
                username=username,
                email=email,
                password_hash=hash_password(password),
                role="admin",
            )
            session.add(user)
            await session.flush()
            print(
                f"[OK] Created admin user: id={user.id} "
                f"username={username} email={email}"
            )
        elif user.role == "admin":
            print(
                f"[INFO] User '{username}' (id={user.id}) is already an admin. "
                "Nothing to do."
            )
        else:
            user.role = "admin"
            print(
                f"[OK] Promoted existing user to admin: "
                f"id={user.id} username={username} email={email}"
            )

        await session.commit()


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)
    asyncio.run(main(sys.argv[1], sys.argv[2], sys.argv[3]))
