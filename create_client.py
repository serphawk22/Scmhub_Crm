"""
Create a client user in the CRM database for local development.

Usage:
    python create_client.py user@example.com

If the user exists, the password will be reset. Default password is `password123`.
"""
import sys
import hashlib
from datetime import datetime, timezone

import bcrypt
from sqlmodel import Session, select

from database import engine, User, ClientProfile, create_db_and_tables


def _hash_password_sha256(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


def _hash_password_bcrypt(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_client(email: str, password: str = "password123"):
    create_db_and_tables()
    sha = _hash_password_sha256(password)
    bcrypt_hash = _hash_password_bcrypt(password)
    now = datetime.now(timezone.utc)

    with Session(engine) as session:
        existing = session.exec(select(User).where(User.email == email)).first()
        if existing:
            existing.password = sha
            existing.hashed_password = bcrypt_hash
            existing.name = existing.name or "Client User"
            existing.role = "Client"
            existing.is_active = True
            session.add(existing)
            session.commit()
            user = existing
            print(f"Updated existing user: {email}")
        else:
            user = User(
                email=email,
                password=sha,
                hashed_password=bcrypt_hash,
                name="Client User",
                role="Client",
                is_active=True,
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            print(f"Created user: {email}")

        # Ensure client profile exists
        profile = session.exec(select(ClientProfile).where(ClientProfile.userId == user.id)).first()
        if not profile:
            profile = ClientProfile(userId=user.id, companyName="Self-registered", websiteUrl="", status="Active")
            session.add(profile)
            session.commit()
            print("Client profile created.")

    print("Credentials:")
    print(f"  Email: {email}")
    print(f"  Password: {password}")


if __name__ == "__main__":
    if len(sys.argv) >= 2:
        email = sys.argv[1]
    else:
        print("Usage: python create_client.py your-email@example.com")
        sys.exit(1)

    create_client(email)
