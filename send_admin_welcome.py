from sqlmodel import Session, select
from database import engine, ServiceRequest, MessageThread, ChatMessage, ServiceCatalog

with Session(engine) as session:
    accepted_reqs = session.exec(select(ServiceRequest).where(ServiceRequest.status == "Accepted")).all()
    for req in accepted_reqs:
        thread = session.exec(select(MessageThread).where(MessageThread.service_request_id == req.id)).first()
        if thread:
            svc = session.get(ServiceCatalog, req.service_id)
            welcome_msg = ChatMessage(
                thread_id=thread.id,
                sender_id=req.assigned_employee_id or 1,
                content=f"Welcome to the service! You have been onboarded with the amount ${svc.cost if svc else 'N/A'}. We will soon start the service.",
                is_system=True
            )
            session.add(welcome_msg)
    session.commit()
print("Admin welcome messages sent to all accepted services.")
