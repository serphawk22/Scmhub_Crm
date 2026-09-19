import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL").replace("postgresql+psycopg2://", "postgresql://")
conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor()

query = """
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
AND usename = current_user;
"""
try:
    cur.execute(query)
    print("Terminated ALL other queries for current_user.")
except Exception as e:
    print("Error:", e)

conn.close()
