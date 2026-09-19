from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select
from database import engine, SentEmail
import base64
from fastapi.responses import Response
import os

router = APIRouter(prefix="/webhook", tags=["email_tracking"])

def get_session():
    with Session(engine) as session:
        yield session

@router.get("/track-email-open")
def track_email_open(id: int, session: Session = Depends(get_session)):
    """
    Webhook receiver for email tracking pixel.
    Updates the email status to 'Opened' and returns a transparent 1x1 pixel.
    """
    email = session.get(SentEmail, id)
    if email and email.status == "Sent":
        email.status = "Opened"
        session.add(email)
        session.commit()

    # Base64 encoded transparent 1x1 GIF
    pixel = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")
    return Response(content=pixel, media_type="image/gif")

from pydantic import BaseModel
from typing import Optional

class EmailReplyPayload(BaseModel):
    email: Optional[str] = None
    email_id: Optional[int] = None

@router.post("/track-email-reply")
def track_email_reply(payload: EmailReplyPayload, session: Session = Depends(get_session)):
    """
    Webhook receiver for email replies (from cron or n8n).
    Expected payload: {"email": "user@example.com"} or {"email_id": 123}
    """
    if payload.email_id:
        email_record = session.get(SentEmail, payload.email_id)
        if email_record:
            email_record.status = "Replied"
            session.add(email_record)
            session.commit()
            return {"status": "success", "message": f"Email ID {payload.email_id} marked as replied"}
    
    if payload.email:
        from sqlmodel import select, desc
        stmt = select(SentEmail).where(SentEmail.to_email == payload.email).order_by(desc(SentEmail.sent_at))
        email_record = session.exec(stmt).first()
        if email_record:
            email_record.status = "Replied"
            session.add(email_record)
            session.commit()
            return {"status": "success", "message": f"Most recent email to {payload.email} marked as replied"}
            
    return {"status": "error", "message": "Email record not found or no valid identifier provided"}