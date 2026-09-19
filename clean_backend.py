import re

db_file = 'database.py'
with open(db_file, 'r') as f:
    content = f.read()

# Classes to remove
classes_to_remove = [
    "MarketplaceService", "ServiceCatalog", "Project", "ProjectTicket", 
    "ProjectTicketHistory", "ProjectTicketNote", "Company", "EmailLog", 
    "CallLog", "ScheduledCall", "SocialProfile", "SEOAudit", "RankingTracker", 
    "AnalyticsData", "Invoice", "Milestone", "NPSSurvey", "Proposal", 
    "KeywordRankEntry", "Deal", "Meeting", "Product", "QuoteItem", "CRMQuote", 
    "SalesOrder", "PurchaseOrder", "InventoryItem", "InventorySupplier", 
    "RFQRequest", "RFQResponse", "ApiRequest", "ApiUsageDaily", "ApiAlert", 
    "APIKey", "APIUsageLog", "LiveChatSession", "LiveChatMessage",
    "WhatsAppSession", "ChatbotSession", "ChatbotMessage"
]

for cls in classes_to_remove:
    # Regex to match class definition until the next class or end of file
    pattern = r'class ' + cls + r'\(.*?\):.*?(?=class |$)'
    content = re.sub(pattern, '', content, flags=re.DOTALL)

# Update roles in User
content = content.replace('role: str = Field(default="Client") # Admin, Employee, Client', 'role: str = Field(default="Developer") # Admin, Developer, Sales')

with open(db_file, 'w') as f:
    f.write(content)

print("Cleaned database.py")
