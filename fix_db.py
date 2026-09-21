from sqlalchemy import text
from database import engine

with engine.connect() as conn:
    conn.execute(text("ALTER TABLE client_notes ALTER COLUMN client_id DROP NOT NULL;"))
    try:
        conn.execute(text("ALTER TABLE client_notes ADD COLUMN lead_id INTEGER REFERENCES leads(id);"))
    except Exception as e:
        print(e)
    conn.execute(text("ALTER TABLE conversation_logs ALTER COLUMN client_id DROP NOT NULL;"))
    try:
        conn.execute(text("ALTER TABLE conversation_logs ADD COLUMN lead_id INTEGER REFERENCES leads(id);"))
    except Exception as e:
        print(e)
    conn.commit()
    print("Database altered successfully")

