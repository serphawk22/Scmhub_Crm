import contextvars
from sqlmodel import Session, select, create_engine
from database import User, Tenant, engine
from main import _add_tenant_filter, current_tenant_id
from sqlalchemy import event
from sqlalchemy.orm import Session as SASession

@event.listens_for(SASession, "do_orm_execute")
def mock_filter(execute_state):
    _add_tenant_filter(execute_state)

with Session(engine) as session:
    try:
        user = session.exec(select(User).where(User.email == "varshithh@gmail.com")).first()
        print("Success:", user)
    except Exception as e:
        import traceback
        traceback.print_exc()
