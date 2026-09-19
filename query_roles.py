from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    try:
        res = conn.execute(text('SELECT DISTINCT role FROM users'))
        roles = [r[0] for r in res.fetchall()]
        print('roles:', roles)
    except Exception as e:
        print('error:', e)
