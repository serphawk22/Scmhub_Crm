import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv(override=True)
DATABASE_URL = os.getenv('DATABASE_URL')
if DATABASE_URL and DATABASE_URL.startswith('postgresql://'):
    DATABASE_URL = DATABASE_URL.replace('postgresql://', 'postgresql+psycopg2://', 1)

engine = create_engine(DATABASE_URL)

sql = """
CREATE TABLE IF NOT EXISTS client_tickets (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES client_profiles(id),
    author_id INTEGER REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
"""

try:
    with engine.connect() as conn:
        conn.execute(text(sql))
        conn.commit()
    print("MIGRATION SUCCESSFUL: Created client_tickets table.")
except Exception as e:
    print("MIGRATION FAILED:", e)
