from sqlmodel import Session, select
from database import engine, User, ClientProfile, MessageThread

with Session(engine) as session:
    users = session.exec(select(User)).all()
    profiles = session.exec(select(ClientProfile)).all()
    threads = session.exec(select(MessageThread)).all()
    print('Users:', [(u.id, u.email, u.role) for u in users])
    print('Profiles:', [(p.id, p.userId) for p in profiles])
    print('Threads:', [(t.id, t.client_id, t.employee_id) for t in threads])
