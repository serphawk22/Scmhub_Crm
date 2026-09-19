import re

with open('main.py', 'r') as f:
    content = f.read()

# ===========================================================================
# 1. Add the background_auto_research helper function BEFORE /smart-research
# ===========================================================================
helper_fn = '''
# ─── Background Auto-Research Helper ────────────────────────────────────────
def _trigger_background_research(entity_id: int, entity_type: str, company_name: str, website: str, session_factory=None):
    """
    Fire-and-forget background task: runs the full scraper+LLM pipeline for a
    lead or client and stores results in ClientResearch.
    entity_type: 'lead' or 'client'
    """
    import threading
    import asyncio

    def _run():
        try:
            from modules.scraper import research_and_map_company
            from modules.llm_engine import generate_email
            import json, re

            url = website or ""
            if not url and company_name:
                slug = company_name.lower().replace(" ", "").replace(",","").replace(".","")
                url = f"https://www.{slug}.com"
            if not url:
                return

            # Run async research in a new event loop
            loop = asyncio.new_event_loop()
            result = loop.run_until_complete(research_and_map_company(url))
            loop.close()

            analysis = result.get("company_analysis", {}) or {}
            mapping = result.get("service_mapping", []) or []
            contacts = analysis.get("contacts", []) or []
            contact = contacts[0] if contacts else {}
            email_addr = (contact.get("email") or "")
            phone_num = (contact.get("phone_number") or "")
            name = (contact.get("name") or "")
            personal_social = contact.get("personal_social_media") or {}
            socials = analysis.get("company_social_media") or {}
            comp_linkedin = socials.get("linkedin", "") if isinstance(socials, dict) else ""
            comp_twitter = socials.get("twitter", "") if isinstance(socials, dict) else ""
            comp_instagram = socials.get("instagram", "") if isinstance(socials, dict) else ""
            comp_facebook = socials.get("facebook", "") if isinstance(socials, dict) else ""
            raw_text = result.get("raw_text", "") or ""

            scraped_emails, scraped_phones = [], []
            em = re.search(r"Extracted Emails:\\s*(.+)", raw_text)
            if em: scraped_emails = [e.strip() for e in em.group(1).split(",") if e.strip()]
            ph = re.search(r"Extracted Phone Numbers:\\s*(.+)", raw_text)
            if ph: scraped_phones = [p.strip() for p in ph.group(1).split(",") if p.strip()]
            li_m = re.search(r"Extracted LinkedIn Profiles:\\s*(.+)", raw_text)
            if li_m and li_m.group(1).strip() and not comp_linkedin:
                comp_linkedin = li_m.group(1).split(",")[0].strip()
            tw_m = re.search(r"Extracted Twitter Profiles:\\s*(.+)", raw_text)
            if tw_m and tw_m.group(1).strip() and not comp_twitter:
                comp_twitter = tw_m.group(1).split(",")[0].strip()
            ig_m = re.search(r"Extracted Instagram Profiles:\\s*(.+)", raw_text)
            scraped_ig = ig_m.group(1).split(",")[0].strip() if (ig_m and ig_m.group(1).strip()) else ""
            fb_m = re.search(r"Extracted Facebook Profiles:\\s*(.+)", raw_text)
            scraped_fb = fb_m.group(1).split(",")[0].strip() if (fb_m and fb_m.group(1).strip()) else ""
            yt_m = re.search(r"Extracted Youtube Profiles:\\s*(.+)", raw_text)
            scraped_yt = yt_m.group(1).split(",")[0].strip() if (yt_m and yt_m.group(1).strip()) else ""

            if email_addr and email_addr not in scraped_emails: scraped_emails.append(email_addr)
            if phone_num and phone_num not in scraped_phones: scraped_phones.append(phone_num)

            recommended_services = [m.get("dapros_service") for m in mapping if m.get("dapros_service") and m.get("dapros_service") != "None"]
            if not recommended_services:
                recommended_services = analysis.get("key_value_props", [])

            draft_result = generate_email(analysis, contact, recommended_services, "")

            data = {
                "company_info": {
                    "company_name": analysis.get("company_name", company_name),
                    "summary": analysis.get("what_they_do", ""),
                    "extracted_emails": ", ".join(scraped_emails),
                    "extracted_phone_numbers": ", ".join(scraped_phones),
                    "linkedin": comp_linkedin,
                    "company_social_media": {
                        "linkedin": comp_linkedin,
                        "twitter": comp_twitter,
                        "instagram": comp_instagram or scraped_ig,
                        "facebook": comp_facebook or scraped_fb,
                        "youtube": scraped_yt
                    }
                },
                "contact": {
                    "email": email_addr,
                    "phone_number": phone_num,
                    "linkedin": personal_social.get("linkedin","") if isinstance(personal_social, dict) else "",
                    "twitter": personal_social.get("twitter","") if isinstance(personal_social, dict) else "",
                    "name": name
                },
                "draft": {
                    "subject": draft_result.get("subject", "Partnership Request"),
                    "english_body": draft_result.get("english_body", ""),
                    "spanish_body": draft_result.get("spanish_body", "")
                },
                "recommended_services": recommended_services,
                "extracted_services": [{"name": m.get("company_service"), "category": "Service", "approx_cost": 0, "cost_is_estimated": False} for m in mapping if m.get("company_service")]
            }

            from sqlmodel import Session as _Session, select as _select
            from database import ClientResearch, Lead, ClientProfile, engine as _engine
            with _Session(_engine) as sess:
                if entity_type == "lead":
                    cr = sess.exec(_select(ClientResearch).where(ClientResearch.lead_id == entity_id)).first()
                    if not cr:
                        cr = ClientResearch(lead_id=entity_id)
                    # Also update lead email/phone if discovered
                    lead_obj = sess.get(Lead, entity_id)
                    if lead_obj:
                        if not lead_obj.email and email_addr: lead_obj.email = email_addr
                        if not lead_obj.phone and phone_num: lead_obj.phone = phone_num
                        sess.add(lead_obj)
                else:
                    cr = sess.exec(_select(ClientResearch).where(ClientResearch.client_id == entity_id)).first()
                    if not cr:
                        cr = ClientResearch(client_id=entity_id)
                cr.email_agent_data = json.dumps(data)
                cr.company_overview = analysis.get("what_they_do", "")
                cr.key_decision_makers = json.dumps(contacts)
                sess.add(cr)
                sess.commit()
            print(f"[AutoResearch] Done for {entity_type} id={entity_id}")
        except Exception as ex:
            import traceback
            print(f"[AutoResearch] Error for {entity_type} id={entity_id}: {ex}")
            traceback.print_exc()

    t = threading.Thread(target=_run, daemon=True)
    t.start()

'''

# Insert before @app.post("/smart-research")
if '_trigger_background_research' not in content:
    content = content.replace('@app.post("/smart-research")', helper_fn + '@app.post("/smart-research")')
    print("Added _trigger_background_research helper.")
else:
    print("Helper already exists, skipping.")

# ===========================================================================
# 2. Patch create_lead to trigger background research
# ===========================================================================
old_lead_return = '''    # ── WHATSAPP NOTIFICATION ──
    try:
        from modules.whatsapp import send_ai_polished_whatsapp_message
        base_url = "https://crm-seo.allytechcourses.com"
        send_ai_polished_whatsapp_message("New Lead Added", lead.dict(), f"{base_url}/leads/{lead.id}")
    except Exception as e:
        print("WhatsApp Error:", e)
        
    return lead'''

new_lead_return = '''    # ── WHATSAPP NOTIFICATION ──
    try:
        from modules.whatsapp import send_ai_polished_whatsapp_message
        base_url = "https://crm-seo.allytechcourses.com"
        send_ai_polished_whatsapp_message("New Lead Added", lead.dict(), f"{base_url}/leads/{lead.id}")
    except Exception as e:
        print("WhatsApp Error:", e)

    # ── AUTO-RESEARCH ──
    try:
        _trigger_background_research(
            entity_id=lead.id,
            entity_type="lead",
            company_name=lead.company_name or "",
            website=lead.website or ""
        )
    except Exception as e:
        print(f"AutoResearch trigger error for lead {lead.id}: {e}")
        
    return lead'''

if old_lead_return in content:
    content = content.replace(old_lead_return, new_lead_return, 1)
    print("Patched create_lead with auto-research trigger.")
else:
    print("WARNING: Could not find exact create_lead WhatsApp block to patch.")

# ===========================================================================
# 3. Patch create_client to trigger background research
# ===========================================================================
old_client_return = '''    # ── WHATSAPP NOTIFICATION ──
    try:
        from modules.whatsapp import send_ai_polished_whatsapp_message
        base_url = "https://crm-seo.allytechcourses.com"
        send_ai_polished_whatsapp_message("New Client Onboarded", cp.dict(), f"{base_url}/clients/{cp.id}")
    except Exception as e:
        print("WhatsApp Error:", e)
        
    return {"client": _client_dict(cp, session)}'''

new_client_return = '''    # ── WHATSAPP NOTIFICATION ──
    try:
        from modules.whatsapp import send_ai_polished_whatsapp_message
        base_url = "https://crm-seo.allytechcourses.com"
        send_ai_polished_whatsapp_message("New Client Onboarded", cp.dict(), f"{base_url}/clients/{cp.id}")
    except Exception as e:
        print("WhatsApp Error:", e)

    # ── AUTO-RESEARCH ──
    try:
        _trigger_background_research(
            entity_id=cp.id,
            entity_type="client",
            company_name=cp.companyName or "",
            website=cp.websiteUrl or ""
        )
    except Exception as e:
        print(f"AutoResearch trigger error for client {cp.id}: {e}")
        
    return {"client": _client_dict(cp, session)}'''

if old_client_return in content:
    content = content.replace(old_client_return, new_client_return, 1)
    print("Patched create_client with auto-research trigger.")
else:
    print("WARNING: Could not find exact create_client WhatsApp block to patch.")

# ===========================================================================
# 4. Patch send-manual to store full draft_json in SentEmail
# ===========================================================================
old_sent_email = '''    sent_email = SentEmail(
        lead_id=lead.id,
        to_email=to_email,
        subject=body.subject,
        english_body=body.english_body,
        spanish_body=body.spanish_body or "",
        recommended_services=body.recommended_services or "",
        manual=body.manual if body.manual is not None else True,
        sent_at=datetime.utcnow(),
    )'''

new_sent_email = '''    import json as _json_se
    _draft_json_payload = _json_se.dumps({
        "subject": body.subject,
        "english_body": body.english_body,
        "spanish_body": body.spanish_body or "",
        "whatsapp_draft": getattr(body, "whatsapp_body", "") or "",
        "contact_name": body.contact_name or "",
        "contact_email": to_email,
        "company_name": body.company_name or "",
        "website_url": getattr(body, "website_url", "") or "",
        "recommended_services": body.recommended_services or "",
    })
    sent_email = SentEmail(
        lead_id=lead.id,
        to_email=to_email,
        subject=body.subject,
        english_body=body.english_body,
        spanish_body=body.spanish_body or "",
        recommended_services=body.recommended_services or "",
        draft_json=_draft_json_payload,
        manual=body.manual if body.manual is not None else True,
        sent_at=datetime.utcnow(),
    )'''

if old_sent_email in content:
    content = content.replace(old_sent_email, new_sent_email, 1)
    print("Patched SentEmail creation to store full draft_json.")
else:
    print("WARNING: Could not find SentEmail constructor block to patch.")

with open('main.py', 'w') as f:
    f.write(content)

print("\nAll patches applied successfully.")
