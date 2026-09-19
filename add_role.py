import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv(override=True)
DATABASE_URL = os.getenv('DATABASE_URL')
if DATABASE_URL and DATABASE_URL.startswith('postgresql://'):
    DATABASE_URL = DATABASE_URL.replace('postgresql://', 'postgresql+psycopg2://', 1)

engine = create_engine(DATABASE_URL)
# Add SalesManager, Employee, Admin to userrole ENUM
try:
    with engine.connect() as conn:
        for role in ['SalesManager', 'Employee', 'Admin', 'Intern']:
            try:
                conn.execute(text(f"ALTER TYPE userrole ADD VALUE '{role}';"))
                conn.commit()
                print(f"Added {role}")
            except Exception as e:
                print(f"Role {role} might already exist or error: {e}")
                conn.rollback() # Important to rollback to continue the loop
        
except Exception as e:
    print("Error:", e)
