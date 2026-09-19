import sqlite3
import os
import uuid

db_path = os.getenv("DATABASE_URL", "sqlite:///database.db").replace("sqlite:///", "")
if not os.path.exists(db_path):
    print(f"Database {db_path} not found.")
    exit(1)

conn = sqlite3.connect(db_path)
c = conn.cursor()

c.execute("""
CREATE TABLE IF NOT EXISTS audit_logs (
    tenant_id INTEGER,
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    table_name VARCHAR(100),
    record_id INTEGER,
    action VARCHAR(20),
    changes TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)
""")

c.execute("""
CREATE TABLE IF NOT EXISTS contacts (
    tenant_id INTEGER,
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    job_title VARCHAR(100),
    department VARCHAR(100),
    notes TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
""")

c.execute("""
CREATE TABLE IF NOT EXISTS contact_lead_links (
    tenant_id INTEGER,
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER,
    lead_id INTEGER,
    role_at_company VARCHAR(100),
    is_primary BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
""")

c.execute("""
CREATE TABLE IF NOT EXISTS contact_client_links (
    tenant_id INTEGER,
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER,
    client_id INTEGER,
    role_at_company VARCHAR(100),
    is_primary BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
""")

conn.commit()
conn.close()
print("Database successfully patched with Audit Logs and Contacts tables!")
