from database import engine
from sqlalchemy import text

try:
    with engine.begin() as conn:
        conn.execute(text('ALTER TABLE notifications ADD COLUMN title VARCHAR(255);'))
    print("Successfully added title to notifications")
except Exception as e:
    print(f"Error: {e}")
