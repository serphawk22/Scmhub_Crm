import os
from sqlmodel import create_engine, text

database_url = os.environ.get("DATABASE_URL")
if not database_url:
    print("No DATABASE_URL")
    exit(1)

engine = create_engine(database_url)

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE sent_emails ADD COLUMN lead_id INTEGER REFERENCES leads(id)"))
        print("Added lead_id to sent_emails")
    except Exception as e:
        print(f"Error adding lead_id to sent_emails: {e}")

    try:
        conn.execute(text("ALTER TABLE activity_logs ADD COLUMN lead_id INTEGER REFERENCES leads(id)"))
        print("Added lead_id to activity_logs")
    except Exception as e:
        print(f"Error adding lead_id to activity_logs: {e}")

    try:
        conn.execute(text("ALTER TABLE client_research ADD COLUMN lead_id INTEGER REFERENCES leads(id)"))
        print("Added lead_id to client_research")
    except Exception as e:
        print(f"Error adding lead_id to client_research: {e}")
        
    conn.commit()

