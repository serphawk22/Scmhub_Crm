from database import engine
from sqlalchemy import text

try:
    with engine.connect() as conn:
        res = conn.execute(text("SELECT unnest(enum_range(NULL::taskstatus))"))
        for row in res:
            print(row[0])
except Exception as e:
    print(e)
