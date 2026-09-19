import psycopg2
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/crm")
print(f"Connecting to {DATABASE_URL}")

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Add project_type
    cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type VARCHAR DEFAULT 'Development';")
    
    # Add clientId
    cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS \"clientId\" INTEGER;")
    
    # Add leadId
    cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS \"leadId\" INTEGER;")
    
    conn.commit()
    print("Successfully added columns to projects table.")
    
except Exception as e:
    print(f"Error: {e}")
finally:
    if 'conn' in locals():
        conn.close()
