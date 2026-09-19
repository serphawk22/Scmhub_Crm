import os
import sqlalchemy as sa
from database import engine

def get_enum_values():
    with engine.connect() as conn:
        result = conn.execute(sa.text("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'notificationtype';"))
        values = [row[0] for row in result]
        print(f"Enum values for notificationtype: {values}")

if __name__ == "__main__":
    get_enum_values()
