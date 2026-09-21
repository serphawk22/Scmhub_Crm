import os
from sqlalchemy import create_engine, inspect
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv('DATABASE_URL')
engine = create_engine(db_url)
inspector = inspect(engine)

tables = inspector.get_table_names()
print(f"Tables: {tables}")

with open('schema_inspect.txt', 'w') as f:
    f.write(f"Tables: {tables}\n")
    for table in tables:
        columns = inspector.get_columns(table)
        f.write(f"\nTable: {table}\n")
        for col in columns:
            f.write(f"  Column: {col['name']} ({col['type']})\n")

print("Schema written to schema_inspect.txt")
