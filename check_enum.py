import psycopg2

try:
    # We can connect to the postgres DB using sqlalchemy config if we parse it, but I can also just run it via sqlalchemy
    from sqlalchemy import create_engine
    from database import postgres_url
    engine = create_engine(postgres_url)
    with engine.connect() as conn:
        res = conn.execute("SELECT unnest(enum_range(NULL::taskstatus))")
        for row in res:
            print(row[0])
except Exception as e:
    print(e)
