from sqlalchemy import create_engine, text
from database import DATABASE_URL

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE tasks ADD COLUMN client_id INTEGER REFERENCES client_profiles(id)"))
        conn.commit()
        print("Column 'client_id' added successfully to tasks.")
    except Exception as e:
        print(f"Error adding column: {e}")
