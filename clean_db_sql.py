import sqlite3

def clean_all_but_admin():
    conn = sqlite3.connect("database.db")
    cursor = conn.cursor()
    
    # Tables to clear
    tables = [
        "task", "deal", "crmquote", "proposal", "invoice", "calllog", "meeting",
        "contact", "lead", "clientprofile", "supportticket", "quoteitem", 
        "project", "projectticket", "projecttickethistory", "projectticketnote",
        "radaranalysis", "competitorrelationship", "remark", "document", "activitylog",
        "auditlog", "company", "emaillog", "scheduledcall", "sentemail", "socialprofile",
        "seoaudit", "competitoranalysis", "rankingtracker", "analyticsdata",
        "notification", "milestone", "npssurvey", "clientfileupload", "keywordrankentry",
        "clientnote", "conversationlog", "conversationreply", "clientresearch",
        "clientticket", "account", "salesorder", "purchaseorder", "case", "solution",
        "emailintegration", "extractedemail", "apirequest", "apiusagedaily",
        "pagevisittelemetry", "apialert", "whatsappsession", "chatbotsession",
        "chatbotmessage", "livechatsession", "livechatmessage", "inventoryitem",
        "inventorysupplier", "rfqrequest", "rfqresponse", "contactleadlink", "contactclientlink"
    ]
    
    for table in tables:
        try:
            cursor.execute(f"DELETE FROM {table}")
            print(f"Cleared table: {table}")
        except sqlite3.OperationalError as e:
            print(f"Skipping {table}: {e}")
            
    # Delete non-admin/salesmanager users? 
    # For now, let's just delete users that are not 'admin'
    cursor.execute("DELETE FROM user WHERE role != 'admin'")
    print("Cleared non-admin users.")
    
    conn.commit()
    conn.close()
    print("Done clearing DB via SQL.")

if __name__ == "__main__":
    clean_all_but_admin()
