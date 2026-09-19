import re

with open('database.py', 'r') as f:
    content = f.read()

# Check if APIUsageLog exists
if 'class APIUsageLog' not in content:
    model_code = """

class APIUsageLog(SQLModel, table=True):
    __tablename__ = "api_usage_logs"
    id: Optional[int] = Field(default=None, primary_key=True)
    method: str = Field(max_length=10)
    path: str = Field(max_length=255)
    status_code: int
    response_time_ms: float
    ip_address: Optional[str] = Field(default=None, max_length=50)
    user_agent: Optional[str] = Field(default=None, max_length=255)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)

"""
    # Append it to the file just before the end or near telemetry tables
    content = content + model_code
    with open('database.py', 'w') as f:
        f.write(content)
    print("Added APIUsageLog to database.py")
else:
    print("APIUsageLog already exists.")
