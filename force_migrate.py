from database import engine, SQLModel
from sqlalchemy import text

def force_update():
    print("Force updating database schema...")
    try:
        # We need to be careful with foreign keys when dropping
        with engine.connect() as conn:
            conn.execute(text("DROP TABLE IF EXISTS activity_logs CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS remarks CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS client_profiles CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS users CASCADE"))
            conn.commit()
        
        SQLModel.metadata.create_all(engine)
        print("✅ Database schema re-created successfully.")
    except Exception as e:
        print(f"❌ Error during schema update: {e}")

if __name__ == "__main__":
    force_update()
