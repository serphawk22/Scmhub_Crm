"""
Seed or reset the CRM admin user. Works with the shared PostgreSQL users table
(which may use bcrypt in hashed_password and require status/name columns).
"""
import hashlib
from datetime import datetime, timezone

import bcrypt
from sqlalchemy import text
from sqlmodel import Session, select

from database import User, engine, create_db_and_tables

ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "Admin@123"
ADMIN_NAME = "System Admin"


def _hash_password_sha256(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


def _hash_password_bcrypt(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def seed_admin():
    create_db_and_tables()
    sha = _hash_password_sha256(ADMIN_PASSWORD)
    bcrypt_hash = _hash_password_bcrypt(ADMIN_PASSWORD)
    now = datetime.now(timezone.utc)

    with Session(engine) as session:
        existing = session.exec(select(User).where(User.email == ADMIN_EMAIL)).first()
        if existing:
            existing.password = sha
            existing.hashed_password = bcrypt_hash
            existing.name = existing.name or ADMIN_NAME
            existing.role = "admin"
            session.add(existing)
            session.commit()
            print("Admin password reset successfully.")
        else:
            session.execute(
                text(
                    """
                    INSERT INTO users (
                        name, email, role, is_active, hashed_password, status,
                        password, created_at, updated_at
                    ) VALUES (
                        :name, :email, :role, :is_active, :hashed_password, :status,
                        :password, :created_at, :updated_at
                    )
                    """
                ),
                {
                    "name": ADMIN_NAME,
                    "email": ADMIN_EMAIL,
                    "role": "admin",
                    "is_active": True,
                    "hashed_password": bcrypt_hash,
                    "status": "APPROVED",
                    "password": sha,
                    "created_at": now,
                    "updated_at": now,
                },
            )
            session.commit()
            print("Admin user created successfully.")

    print(f"   Email: {ADMIN_EMAIL}")
    print(f"   Password: {ADMIN_PASSWORD}")


if __name__ == "__main__":
    seed_admin()
