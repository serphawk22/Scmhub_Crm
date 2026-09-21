import psycopg2
import os
from dotenv import load_dotenv
load_dotenv('.env')
conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()
cur.execute("ALTER TABLE sent_emails ADD COLUMN status VARCHAR(50) DEFAULT 'Sent'")
conn.commit()
print('Success!')
