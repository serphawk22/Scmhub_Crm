import os
from dotenv import load_dotenv
load_dotenv()

from database import engine, SQLModel, ProjectTicketHistory

def run_migration():
    print("Creating ProjectTicketHistory table if not exists...")
    try:
        # Create specifically this table
        ProjectTicketHistory.metadata.create_all(engine, tables=[ProjectTicketHistory.__table__])
        print("✅ project_ticket_history table created successfully.")
    except Exception as e:
        print(f"❌ Error during schema update: {e}")

if __name__ == "__main__":
    run_migration()
