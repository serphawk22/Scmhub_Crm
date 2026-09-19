import ast

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
    
# Remove models from the specific import block at the top
import re
for m in removed_models:
    source = re.sub(r'^\s*'+m+r',?\s*$', '', source, flags=re.MULTILINE)

lines = source.split('\n')
tree = ast.parse(source)

to_remove = set()

for node in ast.walk(tree):
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        # Check if the function uses any removed model
        func_source = '\n'.join(lines[node.lineno-1:node.end_lineno])
        # Also check its decorators
        dec_start = node.lineno
        if node.decorator_list:
            dec_start = node.decorator_list[0].lineno
        
        has_removed = False
        for m in removed_models:
            # simple text matching inside the function block
            if re.search(r'\b' + m + r'\b', func_source):
                has_removed = True
                break
                
        if has_removed:
            for i in range(dec_start - 1, node.end_lineno):
                to_remove.add(i)

new_lines = []
for i, line in enumerate(lines):
    if i not in to_remove:
        new_lines.append(line)

with open("main.py", "w") as f:
    f.write('\n'.join(new_lines))

print("Pruned main.py with AST")
