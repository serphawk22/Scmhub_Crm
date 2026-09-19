from sqlalchemy import create_engine, text
from database import DATABASE_URL

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE notifications ADD COLUMN link VARCHAR"))
        conn.commit()
        print("Column 'link' added successfully.")
    except Exception as e:
        print(f"Error adding column: {e}")
