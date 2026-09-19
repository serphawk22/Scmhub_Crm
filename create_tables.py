from database import engine, create_db_and_tables
from sqlmodel import text

print("Creating all tables in Neon DB...")
create_db_and_tables()
print("Done!")

with engine.connect() as conn:
    result = conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"))
    tables = [r[0] for r in result]
    print("Tables found:", tables)
