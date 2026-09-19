import re

removed_models = {
    "MarketplaceService", "ServiceCatalog", "Project", "ProjectTicket", 
    "ProjectTicketHistory", "ProjectTicketNote", "Company", "EmailLog", 
    "CallLog", "ScheduledCall", "SocialProfile", "SEOAudit", "RankingTracker", 
    "AnalyticsData", "Invoice", "Milestone", "NPSSurvey", "Proposal", 
    "KeywordRankEntry", "Deal", "Meeting", "Product", "QuoteItem", "CRMQuote", 
    "SalesOrder", "PurchaseOrder", "InventoryItem", "InventorySupplier", 
    "RFQRequest", "RFQResponse", "ApiRequest", "ApiUsageDaily", "ApiAlert", 
    "APIKey", "APIUsageLog", "LiveChatSession", "LiveChatMessage",
    "WhatsAppSession", "ChatbotSession", "ChatbotMessage"
}

with open("main.py", "r") as f:
    source = f.read()

for m in removed_models:
    source = re.sub(r'^.*from database import.*\b' + m + r'\b.*$\n', '', source, flags=re.MULTILINE)

with open("main.py", "w") as f:
    f.write(source)

print("Fixed imports")
