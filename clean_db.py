from database import engine, User
from sqlmodel import Session, select

with Session(engine) as session:
    users = session.exec(select(User)).all()
    deactivated = 0
    for u in users:
        if u.role.lower() not in ('admin', 'salesmanager'):
            u.is_active = False
            u.status = "Hold"
            deactivated += 1
    session.commit()
    print(f"Successfully deactivated {deactivated} users.")
