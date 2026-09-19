import re

db_file = 'database.py'
with open(db_file, 'r') as f:
    content = f.read()

deleted_tables = [
    "marketplace_services", "service_catalog", "projects", "project_tickets", 
    "project_ticket_history", "project_ticket_notes", "companies", "email_logs", 
    "call_logs", "scheduled_calls", "social_profiles", "seo_audits", "ranking_trackers", 
    "analytics_data", "invoices", "milestones", "nps_surveys", "proposals", 
    "keyword_rank_entries", "deals", "meetings", "products", "quote_items", "crm_quotes", 
    "sales_orders", "purchase_orders", "inventory_items", "inventory_suppliers", 
    "rfq_requests", "rfq_responses", "api_requests", "api_usage_daily", "api_alerts", 
    "api_keys", "api_usage_logs", "livechat_sessions", "livechat_messages",
    "whatsapp_sessions", "chatbot_sessions", "chatbot_messages"
]

lines = content.split('\n')
new_lines = []

for line in lines:
    keep = True
    for dt in deleted_tables:
        if f'foreign_key="{dt}.id"' in line or f"foreign_key='{dt}.id'" in line:
            keep = False
            break
    if keep:
        new_lines.append(line)

with open(db_file, 'w') as f:
    f.write('\n'.join(new_lines))

print("Removed foreign keys")
