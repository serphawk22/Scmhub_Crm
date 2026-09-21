from database import engine, SQLModel
# Import all models to ensure they are registered
from database import ApiRequest, ApiUsageDaily, ApiAlert

print("Creating API Intelligence database tables...")
SQLModel.metadata.create_all(engine)
print("Done.")
