import os
from dotenv import load_dotenv
from sqlalchemy import text
from sqlmodel import create_engine

load_dotenv()
engine = create_engine(os.environ['DATABASE_URL'])

with engine.connect() as conn:
    try:
        conn.execute(text('ALTER TABLE contacts ADD COLUMN IF NOT EXISTS twitter_url VARCHAR(500);'))
        print("Added twitter_url to contacts")
    except Exception as e:
        print(f"Error: {e}")
        
    try:
        conn.execute(text('ALTER TABLE contacts ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(500);'))
        print("Added linkedin_url to contacts")
    except Exception as e:
        print(f"Error: {e}")
        
    conn.commit()

print("Database migrations complete")
