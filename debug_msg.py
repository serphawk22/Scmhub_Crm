from database import Session, engine, MessageThread, ClientProfile, User, ServiceRequest
from sqlmodel import select

def debug_messaging():
    from database import Session, engine, MessageThread, ClientProfile, User, ServiceRequest, ChatMessage
    from sqlmodel import select, func
    import json
    
    data = {"users": [], "requests": []}
    
    with Session(engine) as session:
        users = session.exec(select(User)).all()
        for u in users:
            profile = session.exec(select(ClientProfile).where(ClientProfile.userId == u.id)).first()
            data["users"].append({
                "id": u.id,
                "email": u.email,
                "role": u.role,
                "profile_id": profile.id if profile else None
            })
        
        reqs = session.exec(select(ServiceRequest)).all()
        for r in reqs:
            thread = session.exec(select(MessageThread).where(MessageThread.service_request_id == r.id)).first()
            req_data = {
                "id": r.id,
                "status": r.status,
                "client_id": r.client_id,
                "thread": None
            }
            if thread:
                msg_count = session.exec(select(func.count(ChatMessage.id)).where(ChatMessage.thread_id == thread.id)).one()
                req_data["thread"] = {
                    "id": thread.id,
                    "client_id": thread.client_id,
                    "msg_count": msg_count
                }
            data["requests"].append(req_data)
            
    with open("debug_out.json", "w") as f:
        json.dump(data, f, indent=2)
    print("Exported to debug_out.json")

if __name__ == "__main__":
    try:
        debug_messaging()
    except Exception as e:
        print(f"DEBUG SCRIPT FAILED: {e}")
        import traceback
        traceback.print_exc()
