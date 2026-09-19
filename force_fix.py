import os
from database import Session, engine, ServiceRequest, MessageThread, ChatMessage, ServiceCatalog
from sqlmodel import select, SQLModel
from datetime import datetime

def force_fix():
    print(f"DATABASE_URL: {os.getenv('DATABASE_URL')}")
    
    # Ensure tables exist just in case
    print("Ensuring tables exist...")
    SQLModel.metadata.create_all(engine)
    
    with Session(engine) as session:
        reqs = session.exec(select(ServiceRequest)).all()
        print(f"Found {len(reqs)} requests.")
        
        for r in reqs:
            # Check for thread
            thread = session.exec(select(MessageThread).where(MessageThread.service_request_id == r.id)).first()
            if thread:
                print(f"Thread for Req {r.id} already exists (ID: {thread.id})")
                continue
                
            print(f"Creating thread for Req {r.id}...")
            new_thread = MessageThread(
                service_request_id=r.id,
                client_id=r.client_id,
                employee_id=r.assigned_employee_id,
                status="Active"
            )
            session.add(new_thread)
            session.flush()
            
            svc = session.get(ServiceCatalog, r.service_id)
            welcome = ChatMessage(
                thread_id=new_thread.id,
                sender_id=r.assigned_employee_id or 1,
                content=f"System: Chat initialized for '{svc.name if svc else 'Service'}'.",
                is_system=True
            )
            session.add(welcome)
            print(f"Added thread and welcome msg for Req {r.id}")
            
        session.commit()
        print("Final commit successful.")

if __name__ == "__main__":
    force_fix()
