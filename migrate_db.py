import os
from sqlalchemy import create_engine, MetaData
from sqlalchemy.orm import sessionmaker
import datetime
from dotenv import load_dotenv

load_dotenv(override=True)

# 1. Connect to old database
old_url = os.getenv("DATABASE_URL")
if old_url and old_url.startswith("postgresql://"):
    old_url = old_url.replace("postgresql://", "postgresql+psycopg2://", 1)

old_engine = create_engine(old_url)
OldSession = sessionmaker(bind=old_engine)

# 2. Connect to new database
new_url = os.getenv("NEW_DATABASE_URL")
if not new_url:
    raise RuntimeError("NEW_DATABASE_URL must be set before migrating databases")
if new_url.startswith("postgresql://"):
    new_url = new_url.replace("postgresql://", "postgresql+psycopg2://", 1)
new_engine = create_engine(new_url)

# 3. Create tables in new database
from database import SQLModel, ClientStatus, User, Project, ClientProfile, Remark, Document, ActivityLog, Company, EmailLog, CallLog, SentEmail, SocialProfile, SEOAudit, CompetitorAnalysis, RankingTracker, AnalyticsData

print("Creating tables in new database...")
SQLModel.metadata.create_all(new_engine)

NewSession = sessionmaker(bind=new_engine)

# Note: The migration loop will just copy all data row by row, table by table.
# Since we have relationships, we need to do this carefully or just bulk dump.
print("Tables created successfully. Commencing data transfer...")

old_session = OldSession()
new_session = NewSession()

# Simple Table copy helper
def copy_table(model):
    print(f"Copying {model.__tablename__}...")
    records = old_session.query(model).all()
    for record in records:
        # Create a new instance without SQLAlchemy internal state
        data = {c.name: getattr(record, c.name) for c in record.__table__.columns}
        new_record = model(**data)
        new_session.merge(new_record) # Merge handles existing PKs gracefully
    new_session.commit()
    print(f"Copied {len(records)} records for {model.__tablename__}.")

try:
    # Hierarchy matters for foreign keys
    copy_table(User)
    copy_table(Project)
    copy_table(ClientProfile)
    copy_table(ClientStatus)
    copy_table(Remark)
    copy_table(Document)
    copy_table(ActivityLog)
    copy_table(Company)
    copy_table(EmailLog)
    copy_table(CallLog)
    copy_table(SentEmail)
    copy_table(SocialProfile)
    copy_table(SEOAudit)
    copy_table(CompetitorAnalysis)
    copy_table(RankingTracker)
    copy_table(AnalyticsData)
    print("Migration complete!")
except Exception as e:
    new_session.rollback()
    print(f"Error during migration: {e}")
finally:
    old_session.close()
    new_session.close()
