import sqlite3
import os

db_path = os.getenv("DATABASE_URL", "sqlite:///database.db").replace("sqlite:///", "")
if not os.path.exists(db_path):
    print(f"Database {db_path} not found.")
    exit(1)

conn = sqlite3.connect(db_path)
c = conn.cursor()

try:
    c.execute("""
    CREATE TABLE automation_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER,
        name VARCHAR(255) NOT NULL,
        trigger VARCHAR(255) NOT NULL,
        action VARCHAR(255) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL
    )
    """)
    print("Created automation_rules table")
except Exception as e:
    print(f"Error creating table: {e}")

conn.commit()
conn.close()
print("Done.")
