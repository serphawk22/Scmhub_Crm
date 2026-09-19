from database import engine, SQLModel, Tenant
from sqlalchemy import text
from sqlmodel import Session

def migrate():
    # 1. Create the new Tenant table
    SQLModel.metadata.create_all(engine)
    
    with Session(engine) as session:
        # Create master tenant if not exists
        tenant = session.exec(text("SELECT id FROM tenants WHERE name='Master Admin'")).first()
        if not tenant:
            master = Tenant(name="Master Admin", business_name="SERP HAWK Main")
            session.add(master)
            session.commit()
            session.refresh(master)
            master_id = master.id
        else:
            master_id = tenant[0]

        print(f"Master tenant ID: {master_id}")

        # List of all tables to migrate (excluding global tables)
        global_tables = ["tenants", "client_statuses", "marketplace_services", "service_catalog"]
        
        # Get all table names from metadata
        all_tables = [table.name for table in SQLModel.metadata.sorted_tables]
        
        for table_name in all_tables:
            if table_name in global_tables:
                continue
                
            print(f"Migrating table {table_name}...")
            try:
                # Add column
                session.execute(text(f"ALTER TABLE {table_name} ADD COLUMN tenant_id INTEGER REFERENCES tenants(id)"))
                # Backfill with master tenant
                session.execute(text(f"UPDATE {table_name} SET tenant_id = {master_id}"))
                session.commit()
                print(f"  -> Added tenant_id to {table_name}")
            except Exception as e:
                session.rollback()
                if "already exists" in str(e) or "DuplicateColumn" in str(e):
                    print(f"  -> Column already exists in {table_name}, backfilling anyway...")
                    try:
                        session.execute(text(f"UPDATE {table_name} SET tenant_id = {master_id} WHERE tenant_id IS NULL"))
                        session.commit()
                    except Exception as inner_e:
                        print(f"  -> Failed to backfill: {inner_e}")
                else:
                    print(f"  -> Error: {e}")

if __name__ == "__main__":
    migrate()
