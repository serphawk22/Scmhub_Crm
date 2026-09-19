import re

db_file = 'database.py'
with open(db_file, 'r') as f:
    content = f.read()

# Fix ServiceRequest
content = re.sub(r'service_id: Optional\[int\] = Field\(default=None, foreign_key="service_catalog\.id", index=True\)', '', content)
content = re.sub(r'service: Optional\[ServiceCatalog\] = Relationship\(back_populates="requests"\)', '', content)

# Fix User
content = re.sub(r'deals: List\["Deal"\] = Relationship\(back_populates="assigned_user"\)', '', content)

# Remove any line that mentions a removed model as a relationship
removed_models = [
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

lines = content.split('\n')
new_lines = []
for line in lines:
    keep = True
    for rm in removed_models:
        if f'[{rm}]' in line or f'["{rm}"]' in line or f'"{rm}"' in line:
            # We don't want to remove imports or valid strings, but mainly Relationships
            if 'Relationship' in line or 'foreign_key' in line:
                keep = False
                break
    if keep:
        new_lines.append(line)

with open(db_file, 'w') as f:
    f.write('\n'.join(new_lines))

print("Fixed db dependencies")
