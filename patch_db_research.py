from sqlalchemy import create_engine, text
from database import DATABASE_URL

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE client_research ADD COLUMN email_agent_data TEXT"))
        conn.commit()
        print("Column 'email_agent_data' added successfully.")
    except Exception as e:
        print(f"email_agent_data error: {e}")
