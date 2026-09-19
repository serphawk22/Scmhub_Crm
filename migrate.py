import os
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import text
from database import engine

def migrate():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE whatsappsession ADD COLUMN active_live_chat_session VARCHAR;"))
            conn.commit()
            print("Column 'active_live_chat_session' added successfully.")
        except Exception as e:
            print("Error or already exists:", e)
            
        try:
            conn.execute(text("ALTER TABLE whatsappsession ALTER COLUMN pending_action DROP NOT NULL;"))
            conn.execute(text("ALTER TABLE whatsappsession ALTER COLUMN action_data DROP NOT NULL;"))
            conn.commit()
            print("Dropped NOT NULL constraints.")
        except Exception as e:
            print("Error dropping constraints:", e)

if __name__ == "__main__":
    migrate()
