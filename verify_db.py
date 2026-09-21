from database import engine, SQLModel
from sqlalchemy import inspect

def verify_and_update():
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f"Tables: {tables}")
    
    # Simple check for ActivityLog columns
    if "activity_logs" in tables:
        columns = [c["name"] for c in inspector.get_columns("activity_logs")]
        print(f"ActivityLog Columns: {columns}")
        if "method" not in columns:
            print("⚠️ Schema mismatch detected! Re-creating tables...")
            # For this CRM tool, we can just drop and recreate for simplicity in dev
            # In production, use migrations
            SQLModel.metadata.drop_all(engine)
            SQLModel.metadata.create_all(engine)
            print("✅ Database schema updated.")
        else:
            print("✅ Schema is correct.")
    else:
        print("Creating all tables...")
        SQLModel.metadata.create_all(engine)
        print("✅ Database initialized.")

if __name__ == "__main__":
    verify_and_update()
