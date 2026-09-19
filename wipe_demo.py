import sqlite3

def clean_all_but_admin():
    conn = sqlite3.connect("database.db")
    cursor = conn.cursor()
    
    # Exclude system tables like tenants, client_statuses, users (partially)
    # We will wipe the core entity tables
    tables = [
        "accounts", "activity_logs", "analytics_data", "api_alerts", "api_keys", "api_requests",
        "api_usage_daily", "audit_logs", "automation_rules", "call_logs", "cases", "chat_messages",
        "chatbotmessage", "chatbotsession", "client_file_uploads", "client_notes", "client_profiles",
        "client_research", "client_tickets", "companies", "competitor_analyses", "competitor_relationships",
        "contact_client_links", "contact_lead_links", "contacts", "conversation_logs", "conversation_replies",
        "deals", "documents", "email_integrations", "email_logs", "extracted_emails", "inventory_items",
        "inventory_suppliers", "invoices", "keyword_rank_entries", "leads", "livechatmessage", "livechatsession",
        "marketplace_services", "meetings", "message_threads", "milestones", "notifications", "nps_surveys",
        "page_visit_telemetry", "products", "project_ticket_history", "project_ticket_notes", "project_tickets",
        "projects", "proposals", "purchase_orders", "quote_items", "quotes", "radar_analyses", "ranking_tracker",
        "remarks", "rfq_requests", "rfq_responses", "sales_orders", "scheduled_calls", "sent_emails", "seo_audits",
        "service_catalog", "service_requests", "social_profiles", "solutions", "task_comments", "tasks",
        "whatsappsession"
    ]
    
    for table in tables:
        try:
            cursor.execute(f"DELETE FROM {table}")
        except sqlite3.OperationalError as e:
            pass
            
    # Delete non-admin/salesmanager users? 
    # For now, let's just delete users that are not 'admin'
    cursor.execute("DELETE FROM users WHERE email != 'admin@example.com' AND role != 'admin'")
    
    conn.commit()
    conn.close()
    print("Done clearing DB via SQL.")

if __name__ == "__main__":
    clean_all_but_admin()
