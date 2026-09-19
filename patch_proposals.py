import sqlite3
import os

db_path = os.getenv("DATABASE_URL", "sqlite:///database.db").replace("sqlite:///", "")
if not os.path.exists(db_path):
    print(f"Database {db_path} not found.")
    exit(1)

conn = sqlite3.connect(db_path)
c = conn.cursor()

try:
    c.execute("ALTER TABLE proposals ADD COLUMN signed_by_ip VARCHAR")
    print("Added signed_by_ip")
except Exception as e:
    print(f"Skipping signed_by_ip: {e}")

try:
    c.execute("ALTER TABLE proposals ADD COLUMN signature_data TEXT")
    print("Added signature_data")
except Exception as e:
    print(f"Skipping signature_data: {e}")

conn.commit()
conn.close()
print("Done.")
