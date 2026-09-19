from sqlalchemy import create_engine, text
from database import DATABASE_URL

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE tasks ADD COLUMN created_by INTEGER REFERENCES users(id)"))
        conn.commit()
        print("Column 'created_by' added successfully.")
    except Exception as e:
        print(f"created_by error: {e}")
