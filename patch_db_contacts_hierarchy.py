import os
import sqlalchemy
from sqlalchemy import create_engine, text

# Get DB URL from env
db_url = os.environ.get("DATABASE_URL")
if not db_url:
    from dotenv import load_dotenv
    load_dotenv()
    db_url = os.environ.get("DATABASE_URL")

if db_url and db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

if not db_url:
    db_url = "sqlite:///database.db"

engine = create_engine(db_url)

with engine.connect() as conn:
    print("Checking if parent_contact_id column exists...")
    try:
        # Try to add the column
        conn.execute(text("ALTER TABLE contacts ADD COLUMN parent_contact_id INTEGER REFERENCES contacts(id);"))
        conn.commit()
        print("Successfully added parent_contact_id column.")
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
            print("Column parent_contact_id already exists.")
        else:
            print("Error:", e)
