import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL").replace("postgresql+psycopg2://", "postgresql://")

conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor()

# Find blocking queries and kill them
query = """
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state IN ('idle in transaction', 'active')
AND pid <> pg_backend_pid();
"""
try:
    cur.execute(query)
    print("Terminated blocking queries.")
except Exception as e:
    print("Error:", e)

conn.close()
