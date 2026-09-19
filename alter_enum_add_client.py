from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TYPE userrole ADD VALUE 'Client'"))
        print("Added enum value 'Client' to userrole")
    except Exception as e:
        print('error adding enum value:', e)
