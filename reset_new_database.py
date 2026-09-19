#!/usr/bin/env python3
"""Reset the configured database to a fresh schema with no data."""

import os
from dotenv import load_dotenv

load_dotenv(override=True)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise SystemExit("DATABASE_URL is not set in .env or environment")

from sqlmodel import SQLModel
from database import engine

if __name__ == "__main__":
    print(f"Using database URL: {DATABASE_URL}")
    print("Dropping all tables...")
    SQLModel.metadata.drop_all(engine)
    print("Creating all tables...")
    SQLModel.metadata.create_all(engine)
    print("Database schema reset complete. The database is now empty.")
