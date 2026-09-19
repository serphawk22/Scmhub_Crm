from sqlalchemy import create_engine, text
from database import DATABASE_URL

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE tasks ADD COLUMN project_id INTEGER REFERENCES projects(id)"))
        conn.commit()
        print("Column 'project_id' added successfully.")
    except Exception as e:
        print(f"project_id error: {e}")

    try:
        conn.execute(text("ALTER TABLE tasks ADD COLUMN assigned_to INTEGER REFERENCES users(id)"))
        conn.commit()
        print("Column 'assigned_to' added successfully.")
    except Exception as e:
        print(f"assigned_to error: {e}")

    try:
        conn.execute(text("ALTER TABLE tasks ADD COLUMN created_by INTEGER REFERENCES users(id)"))
        conn.commit()
        print("Column 'created_by' added successfully.")
    except Exception as e:
        print(f"created_by error: {e}")
