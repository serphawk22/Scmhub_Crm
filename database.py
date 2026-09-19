"""
Database Models and Engine Setup for Cold Outreach CRM
"""
import uuid
from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship, create_engine, Session, JSON
from sqlalchemy import Column, String, Index, DateTime, select, func, Text
from sqlalchemy.dialects.postgresql import JSONB
import os
from dotenv import load_dotenv

load_dotenv(override=True)

# Database URL from environment
# Database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///database.db")

# Windows compatibility fix for psycopg2 and Neon SSL DLLs
if DATABASE_URL and DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

# Create engine with SSL mode for Neon PostgreSQL
connect_args = {}
if DATABASE_URL and DATABASE_URL.startswith("postgresql"):
    connect_args = {
        "connect_timeout": 10,
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5,
    }
engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=False,          # disable: was causing 1 extra RTT per request
    pool_size=10,
    max_overflow=20,
    pool_recycle=300,             # recycle connections every 5 min to keep them fresh
    connect_args=connect_args
)



class Tenant(SQLModel, table=True):
    __tablename__ = "tenants"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True)
    business_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    is_trial: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Limits and Usage
    limit_clients: int = Field(default=15)
    limit_emails: int = Field(default=5)
    limit_searches: int = Field(default=5)
    limit_projects: int = Field(default=5)
    limit_calls: int = Field(default=5)
    
    usage_clients: int = Field(default=0)
    usage_emails: int = Field(default=0)
    usage_searches: int = Field(default=0)
    usage_projects: int = Field(default=0)
    usage_calls: int = Field(default=0)

class EmailSettings(SQLModel, table=True):
    __tablename__ = "email_settings"
    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: int = Field(foreign_key="tenants.id", index=True, unique=True)
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_pass: str
    from_name: str
    from_email: str
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ClientStatus(SQLModel, table=True):
    """
    Dynamic Status configuration for Clients
    """
    __tablename__ = "client_statuses"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, max_length=100)
    color: str = Field(default="bg-gray-500", max_length=50) # Tailwind class
    created_at: datetime = Field(default_factory=datetime.utcnow)


class User(SQLModel, table=True):
    """
    User model for authentication and role management
    """
    __tablename__ = "users"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    password: str
    hashed_password: str = Field(default="")
    name: Optional[str] = None
    phone: Optional[str] = Field(default=None, max_length=50)
    role: str = Field(default="Developer") # Admin, Developer, Sales
    is_active: bool = Field(default=True)
    status: str = Field(default="Active")
    sidebar_preferences: Optional[dict] = Field(default_factory=dict, sa_column=Column(JSON))
    createdAt: datetime = Field(default_factory=datetime.utcnow, sa_column=Column("created_at", DateTime))
    updatedAt: datetime = Field(default_factory=datetime.utcnow, sa_column=Column("updated_at", DateTime))
    
    # Relationships
    # Relationships
    profile: Optional["ClientProfile"] = Relationship(back_populates="user")
    activities: List["ActivityLog"] = Relationship(back_populates="user")
    assigned_requests: List["ServiceRequest"] = Relationship(back_populates="assigned_employee")
    

class PasswordResetToken(SQLModel, table=True):
    """One-time token used to reset a user's password."""
    __tablename__ = "password_reset_tokens"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    token: str = Field(unique=True, index=True, max_length=128)
    expires_at: datetime = Field(index=True)
    used: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    user: Optional["User"] = Relationship()


class EmailOTP(SQLModel, table=True):
    """One-time code sent to verify ownership of an email address for SMTP / integration setup."""
    __tablename__ = "email_otps"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    email: str = Field(max_length=255, index=True)
    otp_code: str = Field(max_length=8)
    purpose: str = Field(max_length=50, default="smtp_settings")  # smtp_settings | integration | signup
    expires_at: datetime = Field(index=True)
    verified: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    user: Optional["User"] = Relationship()


class AutomationRule(SQLModel, table=True):
    """
    Workflow automations (If X happens, do Y)
    """
    __tablename__ = "automation_rules"
    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    name: str = Field(max_length=255)
    trigger: str = Field(max_length=255)  # e.g., "deal_closed", "lead_stale"
    action: str = Field(max_length=255)   # e.g., "send_email", "create_project"
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ServiceRequest(SQLModel, table=True):
    """
    Client's request for a specific service from the catalog.
    """
    __tablename__ = "service_requests"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    id: Optional[int] = Field(default=None, primary_key=True)

    client_id: int = Field(foreign_key="client_profiles.id")
    assigned_employee_id: Optional[int] = Field(default=None, foreign_key="users.id")
    
    status: str = Field(default="Pending") # Pending, Quoted, Accepted, In Progress, Delivered
    requested_at: datetime = Field(default_factory=datetime.utcnow)
    accepted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # Quote fields — Admin fills these in when replying
    quoted_amount: Optional[float] = None
    quote_message: Optional[str] = Field(default=None, sa_column=Column(Text))
    quote_doc_url: Optional[str] = None  # URL to uploaded proposal/document
    team_info: Optional[str] = Field(default=None, sa_column=Column(Text))
    quote_sent_at: Optional[datetime] = None
    client_accepted_quote: bool = Field(default=False)

    # Link to messaging
    threads: List["MessageThread"] = Relationship(back_populates="service_request")

    # Bi-directional relationships
    
    client: Optional["ClientProfile"] = Relationship(back_populates="service_requests")
    assigned_employee: Optional[User] = Relationship(back_populates="assigned_requests")


class MessageThread(SQLModel, table=True):
    __tablename__ = "message_threads"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    id: Optional[int] = Field(default=None, primary_key=True)
    service_request_id: int = Field(foreign_key="service_requests.id")
    client_id: int = Field(foreign_key="client_profiles.id")
    employee_id: Optional[int] = Field(default=None, foreign_key="users.id")
    status: str = Field(default="Active") # Active, Closed
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    service_request: "ServiceRequest" = Relationship(back_populates="threads")
    messages: List["ChatMessage"] = Relationship(back_populates="thread")

class ChatMessage(SQLModel, table=True):
    __tablename__ = "chat_messages"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    id: Optional[int] = Field(default=None, primary_key=True)
    thread_id: int = Field(foreign_key="message_threads.id")
    sender_id: int = Field(foreign_key="users.id")
    content: str = Field(sa_column=Column(Text))
    is_system: bool = Field(default=False)
    is_read: bool = Field(default=False)
    read_at: Optional[datetime] = Field(default=None)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    thread: "MessageThread" = Relationship(back_populates="messages")



class ClientProfile(SQLModel, table=True):
    """
    Detailed profile for clients
    """
    __tablename__ = "client_profiles"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    
    id: Optional[int] = Field(default=None, primary_key=True)
    userId: Optional[int] = Field(default=None, foreign_key="users.id")
    companyName: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    status: str = Field(default="Active") # Active, Hold, Pending
    customFields: Optional[dict] = Field(default_factory=dict, sa_column=Column(JSON))
    assignedEmployeeId: Optional[int] = None
    projectName: Optional[str] = None
    gmbName: Optional[str] = None
    seoStrategy: Optional[str] = None
    tagline: Optional[str] = None
    targetKeywords: Optional[List[str]] = Field(default_factory=list, sa_column=Column(JSON))
    websiteUrl: Optional[str] = None
    recommended_services: Optional[str] = Field(default=None, max_length=1000)
    nextMilestone: Optional[str] = None
    nextMilestoneDate: Optional[str] = None
    lastActivity: Optional[str] = None
    lastActivityDate: Optional[str] = None
    
    # SEO Client Management Tool Workflow fields
    payment_status: str = Field(default="Pending") # Pending, Paid, Failed
    sitemap_url: Optional[str] = None
    cms_type: Optional[str] = None
    
    # Service Tracking
    services_offered: Optional[str] = Field(default=None, sa_column=Column(Text))
    services_requested: Optional[str] = Field(default=None, sa_column=Column(Text))
    outbound_email_sent: bool = Field(default=False)
    inbound_email_sent: bool = Field(default=False)

    # CRM Sales Intelligence Fields
    lead_score: Optional[int] = Field(default=None)  # 0-100
    lead_source: Optional[str] = Field(default=None, max_length=100)  # Cold Email, Referral, Inbound, etc.
    deal_value: Optional[float] = Field(default=None)
    industry: Optional[str] = Field(default=None, max_length=200)
    employee_count: Optional[str] = Field(default=None, max_length=100)
    revenue_range: Optional[str] = Field(default=None, max_length=100)
    linkedin_url: Optional[str] = Field(default=None, max_length=500)
    contact_person: Optional[str] = Field(default=None, max_length=255)
    last_contact_date: Optional[str] = Field(default=None, max_length=50)
    next_followup_date: Optional[str] = Field(default=None, max_length=50)
    
    # AI Call Pitch Widget Tracking
    call_pitch_done: bool = Field(default=False)
    call_pitch_text: Optional[str] = Field(default=None, sa_column=Column(Text))

    # Geo & Radar Discovery Fields
    latitude: Optional[float] = Field(default=None)
    longitude: Optional[float] = Field(default=None)
    place_id: Optional[str] = Field(default=None, max_length=255)
    google_rating: Optional[float] = Field(default=None)
    google_reviews: Optional[int] = Field(default=None)
    market_size_score: Optional[int] = Field(default=None)  # 0-100
    team_size_estimate: Optional[str] = Field(default=None, max_length=50)  # e.g. '11-25'
    business_category: Optional[str] = Field(default=None, max_length=255)

    # CRM Discovery Attribution (Found From)
    discovered_from_client_id: Optional[int] = Field(default=None)  # source client
    discovered_via: Optional[str] = Field(default=None, max_length=100)  # 'Radar Analysis'
    discovery_date: Optional[str] = Field(default=None, max_length=50)
    discovered_from_name: Optional[str] = Field(default=None, max_length=255)  # denormalized label
    
    swot_analysis: Optional[str] = Field(default=None, sa_column=Column(Text))
    
    # Relationships
    user: Optional[User] = Relationship(back_populates="profile")
    remarks: List["Remark"] = Relationship(back_populates="client")
    documents: List["Document"] = Relationship(back_populates="client")
    
    # New relationships for SEO Workflow
    competitor_analyses: List["CompetitorAnalysis"] = Relationship(back_populates="client")
    
    # Store requests
    service_requests: List["ServiceRequest"] = Relationship(back_populates="client")

    # New feature relationships
    file_uploads: List["ClientFileUpload"] = Relationship(back_populates="client")


class RadarAnalysis(SQLModel, table=True):
    """
    Stores a full Google Maps Radar Analysis run for a client.
    """
    __tablename__ = "radar_analyses"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)

    id: Optional[int] = Field(default=None, primary_key=True)
    client_id: Optional[int] = Field(default=None, foreign_key="client_profiles.id", index=True)
    lead_id: Optional[int] = Field(default=None, foreign_key="leads.id", index=True)
    run_date: datetime = Field(default_factory=datetime.utcnow)

    # Target business info
    target_name: Optional[str] = Field(default=None, max_length=255)
    target_place_id: Optional[str] = Field(default=None, max_length=255)
    target_lat: Optional[float] = Field(default=None)
    target_lng: Optional[float] = Field(default=None)
    target_address: Optional[str] = Field(default=None, max_length=500)
    target_phone: Optional[str] = Field(default=None, max_length=100)
    target_website: Optional[str] = Field(default=None, max_length=500)
    target_rating: Optional[float] = Field(default=None)
    target_reviews: Optional[int] = Field(default=None)
    target_category: Optional[str] = Field(default=None, max_length=255)

    # Analysis config
    radius_km: int = Field(default=5)
    market_density_score: Optional[int] = Field(default=None)  # 0-100
    competitor_count: int = Field(default=0)

    # Full competitors JSON array
    competitors: Optional[dict] = Field(default_factory=dict, sa_column=Column(JSON))


class CompetitorRelationship(SQLModel, table=True):
    """
    Tracks the discovery graph: which client was found FROM which radar analysis.
    """
    __tablename__ = "competitor_relationships"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)

    id: Optional[int] = Field(default=None, primary_key=True)
    source_client_id: Optional[int] = Field(default=None, foreign_key="client_profiles.id", index=True)
    source_lead_id: Optional[int] = Field(default=None, foreign_key="leads.id", index=True)
    source_client_name: Optional[str] = Field(default=None, max_length=255)
    discovered_client_id: Optional[int] = Field(default=None, foreign_key="client_profiles.id", index=True)
    discovered_lead_id: Optional[int] = Field(default=None, foreign_key="leads.id", index=True)
    discovered_client_name: Optional[str] = Field(default=None, max_length=255)
    source_radar_id: Optional[int] = Field(default=None, foreign_key="radar_analyses.id")
    discovery_method: str = Field(default="Radar Analysis", max_length=100)
    discovered_date: datetime = Field(default_factory=datetime.utcnow)
    competitor_data: Optional[dict] = Field(default_factory=dict, sa_column=Column(JSON))  # snapshot of competitor info at discovery time


class Remark(SQLModel, table=True):
    """
    Internal or client-facing remarks/comments
    """
    __tablename__ = "remarks"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    
    id: Optional[int] = Field(default=None, primary_key=True)
    content: str = Field(sa_column=Column(Text))
    authorId: Optional[int] = Field(default=None, foreign_key="users.id")
    clientId: Optional[int] = Field(default=None, foreign_key="client_profiles.id")
    isInternal: bool = Field(default=True)
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    client: Optional[ClientProfile] = Relationship(back_populates="remarks")


class Document(SQLModel, table=True):
    """
    Documents and OCR results
    """
    __tablename__ = "documents"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    
    id: Optional[int] = Field(default=None, primary_key=True)
    filename: str
    fileUrl: str
    ocrText: Optional[str] = Field(default=None, sa_column=Column(Text))
    status: str = Field(default="Pending")
    uploaderId: Optional[int] = Field(default=None, foreign_key="users.id")
    clientId: Optional[int] = Field(default=None, foreign_key="client_profiles.id")
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    client: Optional[ClientProfile] = Relationship(back_populates="documents")


class ActivityLog(SQLModel, table=True):
    """
    Logs of user actions and manual client activities
    """
    __tablename__ = "activity_logs"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    
    id: Optional[int] = Field(default=None, primary_key=True)
    userId: Optional[int] = Field(default=None, foreign_key="users.id")
    clientId: Optional[int] = Field(default=None, foreign_key="client_profiles.id")
    lead_id: Optional[int] = Field(default=None, foreign_key="leads.id")
    action: str # e.g., "Manual Activity", "Login", "Profile Update"
    method: Optional[str] = None # Email, Phone, In-person, WhatsApp, Website
    content: Optional[str] = Field(default=None, sa_column=Column(Text))
    details: Optional[str] = Field(default=None, sa_column=Column(Text))
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    user: Optional[User] = Relationship(back_populates="activities")
    client: Optional[ClientProfile] = Relationship()


class AuditLog(SQLModel, table=True):
    """
    Universal audit log capturing created/updated by across all models.
    """
    __tablename__ = "audit_logs"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    table_name: str = Field(max_length=100, index=True)
    record_id: Optional[int] = Field(default=None, index=True)
    action: str = Field(max_length=20) # CREATE, UPDATE, DELETE
    changes: Optional[str] = Field(default=None, sa_column=Column(Text))
    timestamp: datetime = Field(default_factory=datetime.utcnow)



class SentEmail(SQLModel, table=True):
    """
    Stores all sent emails with bilingual body content
    """
    __tablename__ = "sent_emails"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)

    id: Optional[int] = Field(default=None, primary_key=True)
    client_id: Optional[int] = Field(default=None, foreign_key="client_profiles.id")
    lead_id: Optional[int] = Field(default=None, foreign_key="leads.id")
    to_email: str = Field(max_length=255)
    subject: str = Field(max_length=500)
    english_body: Optional[str] = Field(default=None, sa_column=Column(Text))
    spanish_body: Optional[str] = Field(default=None, sa_column=Column(Text))
    recommended_services: Optional[str] = Field(default=None, sa_column=Column(Text))
    manual: Optional[bool] = Field(default=False)
    draft_json: Optional[str] = Field(default=None, sa_column=Column(Text))  # Store the whole draft as JSON
    status: str = Field(default="Sent", max_length=50)  # Sent, Opened, Replied
    sent_at: datetime = Field(default_factory=datetime.utcnow)


class CompetitorAnalysis(SQLModel, table=True):
    __tablename__ = "competitor_analyses"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    id: Optional[int] = Field(default=None, primary_key=True)
    clientId: Optional[int] = Field(default=None, foreign_key="client_profiles.id")
    competitor_domain: str
    keyword_gap_data: Optional[dict] = Field(default_factory=dict, sa_column=Column(JSON))
    backlink_comparison: Optional[dict] = Field(default_factory=dict, sa_column=Column(JSON))
    content_benchmarks: Optional[dict] = Field(default_factory=dict, sa_column=Column(JSON))
    last_updated: datetime = Field(default_factory=datetime.utcnow)
    
    client: Optional[ClientProfile] = Relationship(back_populates="competitor_analyses")

class Task(SQLModel, table=True):
    """Task/Kanban item for tracking work"""
    __tablename__ = "tasks"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(max_length=500)
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    status: str = Field(default="Todo")  # Todo, InProgress, Done
    priority: str = Field(default="Medium")  # Low, Medium, High, Urgent
    due_date: Optional[str] = None
    client_id: Optional[int] = Field(default=None, foreign_key="client_profiles.id")
    lead_id: Optional[int] = Field(default=None, foreign_key="leads.id")
    assigned_to: Optional[int] = Field(default=None, foreign_key="users.id")
    created_by: Optional[int] = Field(default=None, foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    comments: List["TaskComment"] = Relationship(back_populates="task")


class TaskComment(SQLModel, table=True):
    """Comments on tasks"""
    __tablename__ = "task_comments"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    id: Optional[int] = Field(default=None, primary_key=True)
    task_id: int = Field(foreign_key="tasks.id")
    author_id: Optional[int] = Field(default=None, foreign_key="users.id")
    content: str = Field(sa_column=Column(Text))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    task: Optional["Task"] = Relationship(back_populates="comments")


class Notification(SQLModel, table=True):
    """In-app notifications for users"""
    __tablename__ = "notifications"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id")
    title: str = Field(max_length=255)
    message: str = Field(sa_column=Column(Text))
    type: str = Field(default="info")  # info, success, warning, error
    link: Optional[str] = None
    is_read: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ClientFileUpload(SQLModel, table=True):
    """Files uploaded by clients or on their behalf"""
    __tablename__ = "client_file_uploads"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    id: Optional[int] = Field(default=None, primary_key=True)
    client_id: int = Field(foreign_key="client_profiles.id")
    uploaded_by: Optional[int] = Field(default=None, foreign_key="users.id")
    filename: str = Field(max_length=500)
    file_url: str = Field(max_length=1000)
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    description: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    client: Optional[ClientProfile] = Relationship(back_populates="file_uploads")


class ClientNote(SQLModel, table=True):
    """Rich notes with tags and pinning for a client"""
    __tablename__ = "client_notes"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    id: Optional[int] = Field(default=None, primary_key=True)
    client_id: Optional[int] = Field(default=None, foreign_key="client_profiles.id")
    lead_id: Optional[int] = Field(default=None, foreign_key="leads.id")
    content: str = Field(sa_column=Column(Text))
    tags: Optional[List[str]] = Field(default_factory=list, sa_column=Column(JSON))
    is_pinned: bool = Field(default=False)
    author_id: Optional[int] = Field(default=None, foreign_key="users.id")
    author_name: Optional[str] = Field(default=None, max_length=255)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ConversationLog(SQLModel, table=True):
    """Call/meeting/WhatsApp/email/visit conversation logs"""
    __tablename__ = "conversation_logs"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    id: Optional[int] = Field(default=None, primary_key=True)
    client_id: Optional[int] = Field(default=None, foreign_key="client_profiles.id")
    lead_id: Optional[int] = Field(default=None, foreign_key="leads.id")
    title: str = Field(max_length=500)
    type: str = Field(default="call")  # call, meeting, email, whatsapp, visit, other
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    author_id: Optional[int] = Field(default=None, foreign_key="users.id")
    author_name: Optional[str] = Field(default=None, max_length=255)
    attachment_urls: Optional[List[str]] = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    replies: List["ConversationReply"] = Relationship(back_populates="conversation")


class ConversationReply(SQLModel, table=True):
    """Threaded replies on conversation logs"""
    __tablename__ = "conversation_replies"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    id: Optional[int] = Field(default=None, primary_key=True)
    conversation_id: int = Field(foreign_key="conversation_logs.id")
    content: str = Field(sa_column=Column(Text))
    author_id: Optional[int] = Field(default=None, foreign_key="users.id")
    author_name: Optional[str] = Field(default=None, max_length=255)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    conversation: Optional[ConversationLog] = Relationship(back_populates="replies")


class ClientResearch(SQLModel, table=True):
    """Pre-sales research data for a client or lead"""
    __tablename__ = "client_research"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    id: Optional[int] = Field(default=None, primary_key=True)
    client_id: Optional[int] = Field(default=None, foreign_key="client_profiles.id", unique=True)
    lead_id: Optional[int] = Field(default=None, foreign_key="leads.id", unique=True)
    company_overview: Optional[str] = Field(default=None, sa_column=Column(Text))
    competitors: Optional[str] = Field(default=None, sa_column=Column(Text))
    tech_stack: Optional[str] = Field(default=None, sa_column=Column(Text))
    recent_news: Optional[str] = Field(default=None, sa_column=Column(Text))
    pain_points: Optional[str] = Field(default=None, sa_column=Column(Text))
    business_goals: Optional[str] = Field(default=None, sa_column=Column(Text))
    key_decision_makers: Optional[str] = Field(default=None, sa_column=Column(Text))
    email_agent_data: Optional[str] = Field(default=None, sa_column=Column(Text))
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ClientTicket(SQLModel, table=True):
    """Internal support tickets raised by Salesperson to Admin"""
    __tablename__ = "client_tickets"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    id: Optional[int] = Field(default=None, primary_key=True)
    client_id: int = Field(foreign_key="client_profiles.id")
    author_id: Optional[int] = Field(default=None, foreign_key="users.id")
    title: str = Field(max_length=255)
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    status: str = Field(default="Pending")  # Pending, Done, Not Done
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Account(SQLModel, table=True):
    __tablename__ = "accounts"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    id: Optional[int] = Field(default=None, primary_key=True)
    company_name: str = Field(max_length=255, index=True)
    website: Optional[str] = Field(default=None, max_length=500)
    industry: Optional[str] = Field(default=None, max_length=200)
    phone: Optional[str] = Field(default=None, max_length=100)
    address: Optional[str] = Field(default=None, sa_column=Column(Text))
    owner_id: Optional[int] = Field(default=None, foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_activity: Optional[str] = Field(default=None, max_length=500)
    
    contacts: List["Contact"] = Relationship(back_populates="account")
    leads: List["Lead"] = Relationship(back_populates="account")

class Lead(SQLModel, table=True):
    __tablename__ = "leads"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    id: Optional[int] = Field(default=None, primary_key=True)
    company_name: str = Field(max_length=255, index=True)
    website: Optional[str] = Field(default=None, max_length=500)
    industry: Optional[str] = Field(default=None, max_length=200)
    email: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=100)
    address: Optional[str] = Field(default=None, sa_column=Column(Text))
    source: Optional[str] = Field(default=None, max_length=100)
    owner_id: Optional[int] = Field(default=None, foreign_key="users.id")
    status: str = Field(default="New")
    notes: Optional[str] = Field(default=None, sa_column=Column(Text))
    is_converted: bool = Field(default=False)
    converted_client_id: Optional[int] = Field(default=None, foreign_key="client_profiles.id")
    account_id: Optional[int] = Field(default=None, foreign_key="accounts.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_activity: Optional[str] = Field(default=None, max_length=500)
    ai_analysis_results: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    swot_analysis: Optional[str] = Field(default=None, sa_column=Column(Text))

    account: Optional[Account] = Relationship(back_populates="leads")
    contacts: List["Contact"] = Relationship(back_populates="lead")

class LeadNote(SQLModel, table=True):
    """Note attached to an individual lead, with author and timestamp"""
    __tablename__ = "lead_notes"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    id: Optional[int] = Field(default=None, primary_key=True)
    lead_id: int = Field(foreign_key="leads.id", index=True)
    content: str = Field(sa_column=Column(Text))
    author_id: Optional[int] = Field(default=None, foreign_key="users.id")
    author_name: Optional[str] = Field(default=None, max_length=255)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Contact(SQLModel, table=True):
    __tablename__ = "contacts"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    id: Optional[int] = Field(default=None, primary_key=True)
    first_name: str = Field(max_length=100)
    last_name: Optional[str] = Field(default=None, max_length=100)
    full_name: Optional[str] = Field(default=None, max_length=255)
    designation: Optional[str] = Field(default=None, max_length=200)
    department: Optional[str] = Field(default=None, max_length=100)
    email: Optional[str] = Field(default=None, max_length=255)
    mobile_number: Optional[str] = Field(default=None, max_length=100)
    alternate_number: Optional[str] = Field(default=None, max_length=100)
    linkedin_url: Optional[str] = Field(default=None, max_length=500)
    twitter_url: Optional[str] = Field(default=None, max_length=500)
    
    lead_id: Optional[int] = Field(default=None, foreign_key="leads.id")
    account_id: Optional[int] = Field(default=None, foreign_key="accounts.id")
    client_id: Optional[int] = Field(default=None, foreign_key="client_profiles.id")
    
    notes: Optional[str] = Field(default=None, sa_column=Column(Text))
    tags: Optional[List[str]] = Field(default_factory=list, sa_column=Column(JSON))
    owner_id: Optional[int] = Field(default=None, foreign_key="users.id")
    parent_contact_id: Optional[int] = Field(default=None, foreign_key="contacts.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    lead: Optional[Lead] = Relationship(back_populates="contacts")
    account: Optional[Account] = Relationship(back_populates="contacts")



# ──────────────────────────────────────────────────────
# ACTIVITIES: Meeting
# ──────────────────────────────────────────────────────

class Case(SQLModel, table=True):
    """Support cases raised by clients or internal team"""
    __tablename__ = "cases"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    id: Optional[int] = Field(default=None, primary_key=True)
    case_number: Optional[str] = Field(default=None, max_length=100, index=True)
    subject: str = Field(max_length=500)
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    status: str = Field(default="Open", max_length=50)  # Open, In Progress, Resolved, Closed
    priority: str = Field(default="Medium", max_length=50)  # Low, Medium, High, Urgent
    category: Optional[str] = Field(default=None, max_length=200)
    case_type: Optional[str] = Field(default="Bug", max_length=100)  # Bug, Feature Request
    url: Optional[str] = Field(default=None, max_length=1000)  # Related URL
    lead_id: Optional[int] = Field(default=None, foreign_key="leads.id")
    client_id: Optional[int] = Field(default=None, foreign_key="client_profiles.id")
    contact_id: Optional[int] = Field(default=None, foreign_key="contacts.id")
    assigned_to: Optional[int] = Field(default=None, foreign_key="users.id")
    resolution: Optional[str] = Field(default=None, sa_column=Column(Text))
    resolved_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Solution(SQLModel, table=True):
    """Knowledge base solutions for common support cases"""
    __tablename__ = "solutions"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(max_length=500, index=True)
    content: str = Field(sa_column=Column(Text))
    category: Optional[str] = Field(default=None, max_length=200)
    tags: Optional[List[str]] = Field(default_factory=list, sa_column=Column(JSON))
    is_published: bool = Field(default=True)
    view_count: int = Field(default=0)
    helpful_count: int = Field(default=0)
    author_id: Optional[int] = Field(default=None, foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
# ──────────────────────────────────────────────────────
# EMAIL TRACKER: Integrations & Extracted Emails
# ──────────────────────────────────────────────────────

class EmailIntegration(SQLModel, table=True):
    __tablename__ = "email_integrations"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")
    email_address: str = Field(max_length=255)
    provider: str = Field(max_length=50) # Gmail, Outlook, IMAP
    status: str = Field(default="Connected") # Connected, Error, Disconnected
    
    # OAuth Tokens
    access_token: Optional[str] = Field(default=None, sa_column=Column(Text))
    refresh_token: Optional[str] = Field(default=None, sa_column=Column(Text))
    token_expiry: Optional[datetime] = Field(default=None)
    
    last_synced_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ExtractedEmail(SQLModel, table=True):
    __tablename__ = "extracted_emails"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    id: Optional[int] = Field(default=None, primary_key=True)
    integration_id: Optional[int] = Field(default=None, foreign_key="email_integrations.id")
    sender_name: str = Field(max_length=255)
    sender_email: str = Field(max_length=255)
    subject: str = Field(max_length=500)
    body_snippet: Optional[str] = Field(default=None, sa_column=Column(Text))
    suggested_type: str = Field(default="Unknown") # Lead, Client, Spam, Inquiry
    ai_analysis: Optional[str] = Field(default=None, sa_column=Column(Text))
    status: str = Field(default="Pending") # Pending, Verified_Lead, Verified_Client, Dismissed
    received_at: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)


def create_db_and_tables():
    """
    Create all database tables (drops existing tables first to ensure schema matches)
    """
    # Create all tables if they don't exist
    SQLModel.metadata.create_all(engine)
    
    # Run migrations (SQLite safe)
    from sqlalchemy import text
    
    # List of migration queries (removed IF NOT EXISTS for SQLite compatibility)
    migrations = [
        "ALTER TABLE client_profiles ADD COLUMN \"nextMilestone\" VARCHAR(255)",
        "ALTER TABLE client_profiles ADD COLUMN \"nextMilestoneDate\" VARCHAR(255)",
        "ALTER TABLE client_profiles ADD COLUMN \"lastActivity\" VARCHAR(500)",
        "ALTER TABLE client_profiles ADD COLUMN \"lastActivityDate\" VARCHAR(255)",
        "ALTER TABLE client_profiles ADD COLUMN \"services_offered\" TEXT",
        "ALTER TABLE client_profiles ADD COLUMN \"services_requested\" TEXT",
        "ALTER TABLE client_profiles ADD COLUMN \"outbound_email_sent\" BOOLEAN DEFAULT FALSE",
        "ALTER TABLE client_profiles ADD COLUMN \"inbound_email_sent\" BOOLEAN DEFAULT FALSE",
        "ALTER TABLE client_profiles ADD COLUMN \"payment_status\" VARCHAR(50) DEFAULT 'Pending'",
        "ALTER TABLE client_profiles ADD COLUMN \"sitemap_url\" VARCHAR(500)",
        "ALTER TABLE client_profiles ADD COLUMN \"cms_type\" VARCHAR(100)",
        "ALTER TABLE email_logs ADD COLUMN \"subject\" VARCHAR(500)",
        "ALTER TABLE email_logs ADD COLUMN \"content\" TEXT",
        "ALTER TABLE analytics_data ADD COLUMN \"google_ads_spend\" FLOAT DEFAULT 0.0",
        "ALTER TABLE analytics_data ADD COLUMN \"meta_ads_spend\" FLOAT DEFAULT 0.0",
        "ALTER TABLE analytics_data ADD COLUMN \"google_ads_conversions\" INTEGER DEFAULT 0",
        "ALTER TABLE analytics_data ADD COLUMN \"meta_ads_conversions\" INTEGER DEFAULT 0",
        "ALTER TABLE client_profiles ADD COLUMN lead_score INTEGER",
        "ALTER TABLE client_profiles ADD COLUMN lead_source VARCHAR(100)",
        "ALTER TABLE client_profiles ADD COLUMN deal_value FLOAT",
        "ALTER TABLE client_profiles ADD COLUMN industry VARCHAR(200)",
        "ALTER TABLE client_profiles ADD COLUMN employee_count VARCHAR(100)",
        "ALTER TABLE client_profiles ADD COLUMN revenue_range VARCHAR(100)",
        "ALTER TABLE client_profiles ADD COLUMN linkedin_url VARCHAR(500)",
        "ALTER TABLE client_profiles ADD COLUMN contact_person VARCHAR(255)",
        "ALTER TABLE client_profiles ADD COLUMN last_contact_date VARCHAR(50)",
        "ALTER TABLE client_profiles ADD COLUMN next_followup_date VARCHAR(50)",
        # Marketplace indexes (table created by SQLModel.metadata.create_all)
        "CREATE INDEX IF NOT EXISTS ix_marketplace_services_category ON marketplace_services (category)",
        "CREATE INDEX IF NOT EXISTS ix_marketplace_services_provider ON marketplace_services (provider_client_id)",
        # Lead-related columns for cross-module linking
        "ALTER TABLE client_research ADD COLUMN lead_id INTEGER REFERENCES leads(id)",
        "ALTER TABLE sent_emails ADD COLUMN lead_id INTEGER REFERENCES leads(id)",
        "ALTER TABLE activity_logs ADD COLUMN lead_id INTEGER REFERENCES leads(id)",
        "ALTER TABLE tasks ADD COLUMN lead_id INTEGER REFERENCES leads(id)",
        "ALTER TABLE whatsappsession ADD COLUMN active_live_chat_session VARCHAR",
        "ALTER TABLE whatsappsession ALTER COLUMN pending_action DROP NOT NULL",
        "ALTER TABLE whatsappsession ALTER COLUMN action_data DROP NOT NULL",
        "ALTER TABLE products ADD COLUMN photo_url VARCHAR(500)",
        "ALTER TABLE marketplace_services ADD COLUMN tenant_id INTEGER REFERENCES tenants(id)",
        "ALTER TABLE email_otps ALTER COLUMN user_id DROP NOT NULL",
        # Supplier credentials emailing
        "ALTER TABLE inventory_suppliers ADD COLUMN login_password VARCHAR(255)",
        "ALTER TABLE inventory_suppliers ADD COLUMN credentials_sent BOOLEAN DEFAULT FALSE",
    ]
    
    with engine.connect() as conn:
        for query in migrations:
            try:
                conn.execute(text(query))
                conn.commit()
            except Exception as e:
                # Column likely already exists
                conn.rollback()
        
    # Backfill tenant_id on marketplace_services from client_profiles
    try:
        with engine.connect() as conn:
            dialect = engine.dialect.name
            if dialect == "postgresql":
                conn.execute(text("""
                    UPDATE marketplace_services ms
                    SET tenant_id = cp.tenant_id
                    FROM client_profiles cp
                    WHERE ms.provider_client_id = cp.id
                      AND ms.tenant_id IS NULL
                      AND cp.tenant_id IS NOT NULL
                """))
            else:
                conn.execute(text("""
                    UPDATE marketplace_services
                    SET tenant_id = (
                        SELECT cp.tenant_id FROM client_profiles cp
                        WHERE cp.id = marketplace_services.provider_client_id
                          AND cp.tenant_id IS NOT NULL
                    )
                    WHERE marketplace_services.tenant_id IS NULL
                      AND marketplace_services.provider_client_id IS NOT NULL
                """))
            conn.commit()
    except Exception:
        pass
        
    # Seed default statuses if none exist
    try:
        with Session(engine) as session:
            existing_count = session.exec(select(func.count(ClientStatus.id))).one()
            if existing_count == 0:
                print("Seeding default client statuses...")
                defaults = [
                    ClientStatus(name="Active", color="bg-green-500"),
                    ClientStatus(name="Hold", color="bg-orange-500"),
                    ClientStatus(name="Pending", color="bg-blue-500")
                ]
                session.add_all(defaults)
                session.commit()
    except Exception as e:
         print(f"Status seed note: {e}")






# ─── API Intelligence Center Models ──────────────────────────────────────────

class PageVisitTelemetry(SQLModel, table=True):
    """Tracks raw page visits and time spent (dwell time) for SuperAdmin analytics."""
    __tablename__ = "page_visit_telemetry"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    page_path: str = Field(index=True)
    time_spent_seconds: int = Field(default=0)
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)

class ContactLeadLink(SQLModel, table=True):
    __tablename__ = "contact_lead_links"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    
    id: Optional[int] = Field(default=None, primary_key=True)
    contact_id: int = Field(foreign_key="contacts.id", index=True)
    lead_id: int = Field(foreign_key="leads.id", index=True)
    role_at_company: Optional[str] = Field(default=None, max_length=100)
    is_primary: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ContactClientLink(SQLModel, table=True):
    __tablename__ = "contact_client_links"
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id", index=True)
    
    id: Optional[int] = Field(default=None, primary_key=True)
    contact_id: int = Field(foreign_key="contacts.id", index=True)
    client_id: int = Field(foreign_key="client_profiles.id", index=True)
    role_at_company: Optional[str] = Field(default=None, max_length=100)
    is_primary: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)


def get_session():

    """
    Dependency to get database session
    """
    with Session(engine) as session:
        yield session


if __name__ == "__main__":
    print("Creating database tables...")
    create_db_and_tables()
    print("Database tables created successfully!")




