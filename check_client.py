import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()
db_url = os.getenv("DATABASE_URL").replace("postgresql+psycopg2://", "postgresql://")
conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute("SELECT id, tenant_id FROM client_profiles WHERE id = 6;")
print("Client:", cur.fetchone())
conn.close()
