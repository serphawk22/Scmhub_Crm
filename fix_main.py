import re
import traceback
import subprocess

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

with open('main.py', 'r') as f:
    content = f.read()

# Remove them from imports
for rm in removed_models:
    content = re.sub(r'\b' + rm + r'\b,?', '', content)

# A lot of endpoints will be broken. We can remove any endpoint that has a path containing removed features.
# Or any endpoint returning a removed model.
# Let's just remove specific blocks by regex.
# Let's just remove the endpoints containing these words in their route:
paths_to_remove = [
    "/projects", "/inventory", "/orders", "/billing", "/proposals", 
    "/catalog", "/meetings", "/calls", "/marketplace", "/import", 
    "/analytics", "/deals", "/products", "/suppliers", "/quotes"
]

for p in paths_to_remove:
    # Match @app.something("path...
    # until the next @app. or end of file
    pattern = r'@app\.(get|post|put|delete)\("' + p + r'[^"]*"\).*?(?=\n@app\.|\Z)'
    content = re.sub(pattern, '', content, flags=re.DOTALL)

with open('main.py', 'w') as f:
    f.write(content)
print("Cleaned main.py")
