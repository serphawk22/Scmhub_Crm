import os
import json
from dotenv import load_dotenv
import psycopg2

load_dotenv()
db_url = os.getenv("DATABASE_URL").replace("postgresql+psycopg2://", "postgresql://")

conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute("SELECT swot_analysis FROM client_profiles WHERE id = 6;")
row = cur.fetchone()
if row and row[0]:
    swot = row[0]
    print("SWOT exists! Length:", len(swot))
    try:
        json.loads(swot)
        print("Valid JSON.")
    except Exception as e:
        print("Invalid JSON:", e)
else:
    print("SWOT is empty or null.")

conn.close()
