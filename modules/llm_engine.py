import os
from openai import OpenAI
import json



def get_openai_client():
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment variables")
    return OpenAI(api_key=api_key)


def deep_investigate_company(company_name: str, website: str, scraped_text: str = "") -> dict:
    """
    Runs a deep GPT-4o investigation of a company — full business intelligence,
    GTM analysis, ICPs, competitive landscape, proof points, and contact intelligence.
    This is designed to produce the kind of rich analysis you'd get asking
    'do a proper investigation on {company_name}' in ChatGPT.
    """
    try:
        client = get_openai_client()

        context_block = ""
        if scraped_text:
            context_block = f"\n\nRAW SCRAPED WEBSITE CONTENT (use this as primary source, supplement with your own knowledge):\n{scraped_text[:40000]}"

        prompt = f"""You are a world-class business analyst, GTM strategist, and OSINT researcher. 
Do a PROPER, EXHAUSTIVELY DEEP investigation of the company below. Think like a top-tier McKinsey consultant and a seasoned GTM Director who needs to completely deconstruct this business before writing a highly tailored growth plan.

Company Name: {company_name}
Website: {website}{context_block}

Perform a comprehensive investigation and return a rich JSON object. 
Instead of strict fields, write a massive, incredibly detailed 2000-15000 word markdown report in the "full_markdown_report" field. This report should contain the ENTIRE analysis, exactly as you would output it directly in ChatGPT (using headings, bold text, bullet points, and tables if necessary).

Cover absolutely everything in extreme detail:
1. Executive Summary & Core Value Proposition
2. Comprehensive Product/Service Portfolio Breakdown: Analyze ALL services offered on their website in detail.
3. Marketing & Lead Generation: Take a deep look at their marketing strategies, how they are generating leads, and their digital footprint.
4. Business & Financials: Provide estimates or insights on their revenue, business size, and scale based on available data.
5. Detailed Ideal Customer Profiles (ICPs) with specific pains, deep desires, and perfectly crafted hooks
6. Complete Competitive Landscape (who are their top 3-5 competitors, what are they doing better, where is this company weak)
7. Sales & GTM Strategy: What channels should they use? What are the quick wins?
8. Common Objections & Rebuttals (What will prospects say to say no, and how to counter it)
9. Cold Email Angles (Provide 3 distinct cold email angles/hooks for outreach)
10. SEO & Digital Presence analysis (What is missing? SERP Hawk opportunities)

Return ONLY valid JSON with this exact structure:
{{
    "executive_verdict": "A powerful 2-3 sentence executive summary of whether this company is a good target and why.",
    "company_overview": "A detailed paragraph summarizing the company, what they do, and their market position.",
    "industry": "Specific industry",
    "business_model": "e.g. B2B SaaS, B2C E-commerce, Agency, Manufacturing",
    "years_in_business": "e.g. 5+ years",
    "geographic_presence": "e.g. North America, Global, Local (City)",
    "biggest_opportunities": ["Opportunity 1", "Opportunity 2"],
    "key_weaknesses": ["Weakness 1", "Weakness 2"],
    "strongest_proof_points": [
        {{"type": "Metric/Client/Award", "value": "e.g. 10k+ Users", "why_it_matters": "Shows scale"}}
    ],
    "product_portfolio": [
        {{"name": "Product A", "description": "What it is", "pricing_tier": "High/Med/Low", "target_customer": "Who buys this"}}
    ],
    "competitive_landscape": {{
        "competitive_positioning": "How they position themselves vs others",
        "main_competitors": [
            {{"name": "Competitor 1", "how_they_compete": "Their angle", "overlap": "High/Medium/Low"}}
        ]
    }},
    "ideal_customer_profiles": [
        {{"name": "ICP Name", "pain": "Their core problem", "desire": "What they want", "best_message": "A 1-sentence hook to grab their attention"}}
    ],
    "gtm_recommendations": {{
        "positioning_statement": "How we should position our pitch to them",
        "quick_wins": ["Action 1", "Action 2"]
    }},
    "serphawk_opportunity": {{
        "fit_score": 8,
        "pitch_angle": "How to sell to them",
        "estimated_deal_value": "$5k - $10k",
        "recommended_services": ["SEO", "Web Dev"]
    }},
    "contacts": [
        {{
            "name": "Decision maker name if known, else null",
            "role": "Their title/role",
            "email": "Email if found, else null",
            "phone_number": "Phone if found, else null",
            "personal_social_media": {{"linkedin": "url", "twitter": "url"}}
        }}
    ],
    "company_info": {{
        "company_name": "{company_name}",
        "summary": "2-3 sentence summary for the CRM card",
        "extracted_emails": "Comma-separated email addresses found",
        "extracted_phone_numbers": "Comma-separated phone numbers found",
        "linkedin": "Company LinkedIn URL if found",
        "company_social_media": {{
            "linkedin": "LinkedIn URL or null",
            "twitter": "Twitter/X URL or null"
        }}
    }},
    "full_markdown_report": "Your 500-1500 word detailed markdown report covering the entire deep investigation."
}}

Be specific, data-driven, and insightful. Reference real details about this company wherever possible.
Do NOT use generic placeholder text anywhere.
CRITICAL: You are outputting JSON. You MUST properly escape all newlines in your markdown report as \\n."""

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.4
        )

        content = response.choices[0].message.content
        try:
            result = json.loads(content)
        except json.JSONDecodeError as e:
            # Fallback: attempt to fix unescaped newlines in the JSON string
            print(f"[deep_investigate_company] JSONDecodeError: {e}. Attempting repair...")
            # A naive fix for unescaped newlines in JSON values
            fixed_content = content.replace("\n", "\\n")
            # But wait, replace("\n", "\\n") would also escape structural newlines.
            # Instead, just use a more lenient parser or let it fail with better logging.
            # For now, let's just log it and re-raise so the debug block catches it.
            raise e
        return result

    except Exception as e:
        print(f"[deep_investigate_company] Error: {e}")
        try:
            print(f"[deep_investigate_company] Raw Content Length: {len(response.choices[0].message.content)}")
            print(f"[deep_investigate_company] Finish Reason: {response.choices[0].finish_reason}")
            print(f"[deep_investigate_company] Raw Content Start: {response.choices[0].message.content[:500]}")
            print(f"[deep_investigate_company] Raw Content End: {response.choices[0].message.content[-500:]}")
        except:
            pass
        return {
            "company_name": company_name,
            "executive_verdict": f"Investigation failed: {e}",
            "company_overview": "",
            "contacts": [],
            "company_info": {"company_name": company_name, "summary": "", "extracted_emails": "", "extracted_phone_numbers": "", "company_social_media": {}},
            "draft": {"subject": "", "english_body": "", "spanish_body": "", "whatsapp_draft": ""},
            "error": str(e)
        }


def analyze_content(text):
    """
    Analyzes website text using OpenAI.
    """
    try:
        client = get_openai_client()
        prompt = f"""
        You are an expert business analyst and OSINT researcher. Given the following website text, do real research (using your knowledge and reasoning) and return a JSON object with:
        {{
            "company_name": "The real name of the company (never a placeholder)",
            "what_they_do": "A real, concise summary of what this company does (2-3 sentences, never a template)",
            "summary": "A 2-3 sentence description",
            "likely_industry": "Industry guess",
            "business_model": "B2B or B2C",
            "estimated_size": "E.g. 1-10 employees",
            "target_market": "E.g. Local, National",
            "geographic_presence": "Where they operate",
            "best_conversion_opportunity": "How we can help them",
            "sales_follow_up_focus": "Next steps for sales",
            "extracted_emails": ["List of ALL email addresses exactly as found in Extracted Emails"],
            "extracted_phone_numbers": "Comma separated string of ALL phone numbers exactly as found in Extracted Phone Numbers",
            "extracted_linkedin": "The primary company LinkedIn URL found in Extracted LinkedIn Profiles",
            "extracted_twitter": "The primary company Twitter/X URL found in Extracted Twitter Profiles",
            "company_social_media": {{
                "linkedin": "Company LinkedIn URL or null",
                "twitter": "Company Twitter/X URL or null",
                "instagram": "Company Instagram URL or null",
                "facebook": "Company Facebook URL or null",
                "youtube": "Company Youtube URL or null"
            }},
            "contacts": [
                {{
                    "name": "If you can infer a real contact name, otherwise null",
                    "role": "If you can infer a real role (e.g. Founder, CEO), otherwise null",
                    "email": "A real company email address (look at the 'Extracted Emails' list at the top)",
                    "phone_number": "A real company phone number (look at the 'Extracted Phone Numbers' list at the top)",
                    "personal_social_media": {{
                        "linkedin": "Personal LinkedIn URL if found, else null",
                        "twitter": "Personal Twitter/X URL if found, else null"
                    }},
                    "context": "How you found or inferred this contact, or null"
                }}
            ],
            "key_value_props": ["List of actual services or products that the scraped company provides to its customers (e.g. SEO, Web Design, Plumbing, Consulting, etc)"]
        }}

        For `key_value_props`, extract the ACTUAL services the company offers based on their website, do NOT output Dapros/Serphawk services.

        Look closely at the 'Extracted Emails', 'Extracted Phone Numbers', and any 'Social Links' in the company info below. Always prefer using the actual scraped links and emails instead of placeholders or guesses. Extract as many people/decision makers as possible.

        Company Info:
        {text[:60000]}
        """

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )

        result = json.loads(response.choices[0].message.content)
        return result
    except Exception as e:
        print(f"Error in OpenAI analysis: {e}")
        return {
            "company_name": "Unknown",
            "what_they_do": "Analysis failed",
            "contacts": [],
            "error": str(e)
        }


def generate_email(analysis, contact=None, recommended_services=None, owner_name="Varshith"):
    """
    Generates a personalized bilingual cold email using OpenAI.
    Returns english_body (para 1) and spanish_body (para 2) separately.
    """
    try:
        client = get_openai_client()
        recipient_info = f"Recipient: {contact.get('name')} ({contact.get('role')})" if contact else "General Inbox"

        company_name = analysis.get('company_name', '')
        what_they_do = analysis.get('what_they_do', analysis.get('summary', ''))
        services = analysis.get('key_value_props', [])
        website = ''
        if 'website' in analysis:
            website = analysis['website']

        # Use recommended_services if provided (from smart-research flow)
        services_to_mention = []
        if recommended_services and isinstance(recommended_services, list):
            for svc in recommended_services:
                if isinstance(svc, dict):
                    services_to_mention.append(svc.get('service_name', ''))
                elif isinstance(svc, str):
                    services_to_mention.append(svc)
        if not services_to_mention:
            services_to_mention = services

        services_list_str = ', '.join(services_to_mention) if services_to_mention else 'SEO, digital marketing, and automation'

        prompt = f"""
        You are an expert B2B outreach copywriter writing on behalf of Team DaPros (SERP Hawk Digital Agency). Use ONLY the provided company info below. Do not invent details.

        PROSPECT INFO:
        Company: {company_name}
        Website: {website}
        What they do: {what_they_do}
        {recipient_info}

        SERVICES TO HIGHLIGHT: {services_list_str}

        OUR FULL SERVICE CATALOG (for context):
        • Organic SEO — higher Google rankings, more organic traffic
        • Local SEO — dominate Google Maps & local search
        • Google Ads — targeted PPC with measurable ROI
        • Meta Ads — Facebook & Instagram campaigns that convert
        • Social Media — brand presence & audience engagement
        • Content Marketing — SEO blogs, landing pages, conversion copy
        • Web Development — fast, modern, conversion-optimized sites
        • App Development — custom mobile & web applications
        • Automation & Consulting — smart workflows & strategy

        EMAIL STRUCTURE (English):
        1. Hook (1-2 sentences) — A specific observation about {company_name}'s online presence or an opportunity you spotted. Make it personal.
        2. Problem/Opportunity (2-3 sentences) — A concrete challenge they likely face based on their industry and what they do.
        3. Service Spotlight (3-5 sentences) — For EACH service in [{services_list_str}], write one clear sentence: what it does + the measurable result for them. Use concrete outcomes like "rank on page 1", "2x local visibility", "cut ad spend waste by 30%".
        4. Social proof (1 sentence) — Mention working with similar businesses to build trust.
        5. CTA (1 sentence) — Invite them to a free 15-minute strategy call. Make it effortless.
        6. Sign-off: "Best regards,\n{owner_name} | SERP Hawk Digital Agency"

        STYLE: 120-180 words total. Short paragraphs (2-3 sentences each), separated by blank lines. Conversational, confident, zero fluff. Services are the STAR — the reader should finish knowing exactly what you offer and why it matters for them.

        Then provide the FULL Spanish translation with identical structure, signed as "Saludos cordiales,\n{owner_name} | SERP Hawk Digital Agency".

        Then provide a short, punchy WhatsApp message (English only) to send to them. Keep it under 50 words. It should be casual but professional, mention the opportunity, and ask for a quick chat.

        Then provide a short, punchy WhatsApp message (English only) to send to them. Keep it under 50 words. It should be casual but professional, mention the opportunity, and ask for a quick chat.

        Return a JSON object with exactly these fields:
        {{
            "subject": "Short benefit-focused subject (under 8 words, mention company or sector)",
            "english_body": "Full English email (short paragraphs separated by \\n\\n, plain text, no HTML)",
            "spanish_body": "Full Spanish translation (same structure, plain text, no HTML)",
            "whatsapp_draft": "Short, punchy WhatsApp message (plain text, emojis allowed)"
        }}
        """

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )

        result = json.loads(response.choices[0].message.content)
        # Ensure backward compatibility with 'body' key
        result["body"] = result.get("english_body", "") + "\n\n" + result.get("spanish_body", "")
        return result
    except Exception as e:
        return {"subject": "Error", "english_body": str(e), "spanish_body": "", "body": str(e)}

def analyze_document(image_bytes):
    """
    Analyzes a business card or ID card image using GPT-4o Vision and returns extracted JSON.
    Tries gpt-4o-mini first, falls back to gpt-4o on failure.
    """
    import base64
    client = get_openai_client()
    base64_image = base64.b64encode(image_bytes).decode('utf-8')

    print(f"OCR: Received image, size={len(image_bytes)} bytes")

    # Auto-detect MIME type from file magic bytes
    if len(image_bytes) >= 4 and image_bytes[:4] == b'\x89PNG':
        mime_type = "image/png"
    elif len(image_bytes) >= 2 and image_bytes[:2] == b'\xff\xd8':
        mime_type = "image/jpeg"
    elif len(image_bytes) >= 6 and image_bytes[:6] in (b'GIF87a', b'GIF89a'):
        mime_type = "image/gif"
    elif len(image_bytes) >= 12 and image_bytes[:4] == b'RIFF' and image_bytes[8:12] == b'WEBP':
        mime_type = "image/webp"
    else:
        mime_type = "image/jpeg"

    print(f"OCR: Detected MIME type: {mime_type}")

    prompt = (
        "You are an expert at reading business cards and ID cards. "
        "Examine this image carefully and extract every piece of contact information visible.\n"
        "Look for: full names, company/organization names, phone numbers, mobile numbers, "
        "email addresses, and website URLs.\n"
        "Return ONLY a valid JSON object with exactly these keys:\n"
        '{\n'
        '  \"name\": \"Full name of the person (empty string if not found)\",\n'
        '  \"company_name\": \"Company or organization name (empty string if not found)\",\n'
        '  \"mobile\": \"Phone or mobile number (empty string if not found)\",\n'
        '  \"email\": \"Email address (empty string if not found)\",\n'
        '  \"website\": \"Website URL (empty string if not found)\"\n'
        '}\n'
        "Do not add any other fields or explanations. Return only the JSON."
    )

    # Try gpt-4o-mini first, fall back to gpt-4o if it fails
    for model in ["gpt-4o-mini", "gpt-4o"]:
        try:
            print(f"OCR: Trying model {model}...")
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{base64_image}",
                                    "detail": "low"
                                }
                            },
                        ],
                    }
                ],
                response_format={"type": "json_object"},
                max_tokens=500
            )

            raw = response.choices[0].message.content
            print(f"OCR raw response from {model}: {raw}")
            result = json.loads(raw)

            # Ensure all required fields exist
            result.setdefault("name", "")
            result.setdefault("company_name", "")
            result.setdefault("mobile", "")
            result.setdefault("email", "")
            result.setdefault("website", "")

            print(f"OCR Success ({model}): {result}")
            return result

        except Exception as e:
            print(f"OCR Error with {model}: {type(e).__name__}: {e}")
            if model == "gpt-4o":
                # Both models failed
                return {
                    "error": f"OCR failed: {str(e)}",
                    "name": "",
                    "company_name": "",
                    "mobile": "",
                    "email": "",
                    "website": ""
                }
            continue

def extract_tasks_from_note(note_content):
    """
    Uses GPT-4o to read a meeting note or conversation log and extract actionable tasks.
    Returns a list of dictionaries with 'title' and 'description'.
    """
    try:
        client = get_openai_client()
        prompt = f"""
        You are an expert sales assistant. Read the following meeting note or conversation log and extract all clear actionable tasks or next steps that need to be done.
        
        Note content:
        {note_content}
        
        Return ONLY a JSON object with a single key "tasks" which contains an array of objects. 
        Each task object must have exactly two keys:
        - "title": A short, clear task title (max 5-7 words).
        - "description": Additional details or context for the task.
        
        If there are no actionable tasks, return {{"tasks": []}}.
        """

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
        return result.get("tasks", [])
    except Exception as e:
        print(f"Error in task extraction: {e}")
        return []

def process_chatbot_command(message: str, client_context: dict = None, current_route: str = None, crm_summary: str = "", user_role: str = None):
    """
    Analyzes user message using OpenAI Function Calling to determine one or more CRM actions.
    Role-aware: adapts capabilities, persona, and tools based on the logged-in user's role.
    """
    import json
    try:
        client_ai = get_openai_client()
        context_str = f"Client context: {json.dumps(client_context)}" if client_context else "No specific client context."
        route_str = f"User's current page route: {current_route}" if current_route else "Unknown route."

        # ── Role-specific persona and capability definitions ─────────────────
        role = (user_role or "").strip()

        # ── Common CRM knowledge base ─────────────────────────────────────────
        CRM_KNOWLEDGE = """
=== SERP HAWK CRM — COMPLETE NAVIGATION & FEATURE GUIDE ===

SIDEBAR NAVIGATION STRUCTURE:
• Dashboard → / → Overview of revenue, pipeline, recent activity, quick links
• My Work Queue → /work-queue → Your assigned tasks and follow-ups
• Notifications → /notifications → Alerts, mentions, and system events

CRM SECTION:
• Leads → /leads → Prospects not yet converted. Add new leads, track pipeline stages (New, Qualified, Discovery, Proposal, Negotiation, Won, Lost), view AI Agent Analysis, run Pre-Sales Research, extract services
• Contacts → /contacts → Individual contact persons linked to leads or clients
• Clients → /clients → Converted or direct clients. Full profile with Opportunities tab, Tasks, Timeline, Files, Health, Conversations, Tickets tabs. Run AI analysis, extract services

AI AGENTS SECTION:
• Email Agent → /email-agent → AI-powered outbound email drafting. Enter website URL → AI generates personalized email pitch

PROJECTS & ACTIVITIES:
• Projects → /projects → Manage client projects, tasks (Kanban board), milestones
• Meetings → /meetings → Schedule and log meetings
• Calls → /calls → Log and review call records

TEAMS:
• Team Directory → /team → View all team members, roles, contact info
• Leaderboard → /leaderboard → Sales performance rankings

INVENTORY:
• Inventory → /inventory → Physical stock management
• Catalog → /catalog → Product/service catalog
• Orders → /orders → Customer orders
• Billing → /billing → Invoices, quotes, payment records
• Proposals → /proposals → Create and send proposals to clients
• Marketplace → /admin/marketplace → Services extracted from leads/clients, listed as offerings

SUPPORT:
• Cases → /cases → Customer support tickets and case management
• Solutions → /solutions → Knowledge base and solution articles

SYSTEM:
• Import Data → /import → Bulk import clients or leads via CSV/Google Sheets
• Demo Account Data → /demo → Demo data management
• API Intelligence → /admin/api-intelligence → Track OpenAI API usage, costs

=== HOW TO DO COMMON ACTIONS ===

HOW TO ADD A LEAD:
1. Click "Leads" in the left sidebar under CRM
2. Click the "+ Add Lead" button (top right)
3. Fill in Company Name (required), Website, Industry, Email, Phone, Source, Status
4. Click Save → A Sales Team Assignment popup appears
5. Choose a salesperson manually OR click "Auto Assign" to pick the least-busy one
6. Click "Assign & Create" (or "Skip for now")

HOW TO ADD A CLIENT:
1. Click "Clients" in the left sidebar under CRM
2. Click the "+ Add Client" button (top right)
3. Fill in Company Name, Website URL (required for autofill), Email, Project Name, GMB Name, SEO Strategy, Tagline, Keywords
4. You can click "🪄 Autofill" to auto-extract info from the website
5. Click "Create Client" → A Sales Team Assignment popup appears
6. Choose or auto-assign a salesperson → Click "Assign & Create"

HOW TO RUN AI ANALYSIS ON A LEAD/CLIENT:
1. Go to Leads or Clients → Click on the specific lead/client
2. Go to the "Opportunities" tab
3. Click "Analyze Lead with AI" (or "Analyze Client with AI")
4. Wait for the AI to generate SWOT analysis, company overview, competitors, pain points

HOW TO EXTRACT SERVICES FROM A WEBSITE:
1. Go to a Lead or Client detail page
2. Go to the "Opportunities" tab → Pre-Sales Research section
3. Click "Extract Services from Website"
4. AI scrapes the website and lists services → They are automatically added to Marketplace

HOW TO SEND AN EMAIL:
1. Click "Email Agent" in the left sidebar
2. Enter the target website URL or select a client
3. AI generates a personalized email pitch
4. Edit if needed → Send or copy

HOW TO ASSIGN A SALESPERSON:
- When creating a Lead or Client, the Sales Assignment popup appears automatically
- To reassign: Go to the client/lead detail page → Right sidebar → "Assign Salesperson" dropdown
- "Auto Assign" picks the salesperson with the fewest active clients + leads

HOW TO CREATE A TASK:
1. Go to Projects or a specific Client/Lead detail page
2. Click the "Tasks" tab
3. Click "+ Add Task" → Fill in title, description, due date, assignee
4. Tasks appear in My Work Queue for the assigned person

HOW TO LOG A CALL:
1. Click "Calls" in the sidebar
2. Click "+ Log Call"
3. Fill in the client, duration, outcome, notes

HOW TO CREATE AN INVOICE/QUOTE:
1. Click "Billing" in the sidebar
2. Click "+ New Invoice" or "+ New Quote"
3. Select client, add line items, set due date → Save and send

HOW TO IMPORT LEADS/CLIENTS IN BULK:
1. Click "Import Data" in the sidebar (System section)
2. Paste a Google Sheet CSV URL or upload a CSV file
3. Map columns to CRM fields → Preview → Import

=== NAVIGATION LINKS (EXACT ROUTES) ===
Dashboard='/', Leads='/leads', Contacts='/contacts', Clients='/clients',
Email Agent='/email-agent', Projects='/projects', Meetings='/meetings', Calls='/calls',
Team='/team', Leaderboard='/leaderboard', Inventory='/inventory', Catalog='/catalog',
Orders='/orders', Billing='/billing', Proposals='/proposals', Marketplace='/admin/marketplace',
Cases='/cases', Solutions='/solutions', Import='/import', API Intelligence='/admin/api-intelligence',
Work Queue='/work-queue', Notifications='/notifications'
"""

        if role == "Admin":
            persona = f"""You are the SERP Hawk CRM AI Assistant — a specialist guide for THIS CRM ONLY.

CRITICAL RULE: You ONLY answer questions about SERP Hawk CRM. If the user asks ANYTHING unrelated to this CRM (general knowledge, coding, math, weather, news, etc.), politely refuse and redirect: "I can only help with SERP Hawk CRM questions. What would you like to know about the CRM?"

You have FULL Admin access to all modules. You provide:
- Step-by-step instructions for any CRM action
- Navigation guidance to any page
- Explanations of any feature or module
- Help with managing clients, leads, deals, billing, team, etc.

{CRM_KNOWLEDGE}"""
            allowed_tools = "all"
            route_map = "Dashboard='/', Clients='/clients', Leads='/leads', Billing='/billing', Inventory='/inventory', Products='/catalog', Catalog='/catalog', Orders='/orders', Projects='/projects', Tasks='/tasks', Meetings='/meetings', Calls='/calls', Email Agent='/email-agent', Marketplace='/admin/marketplace', Settings='/setup', Notifications='/notifications', Team='/team', Leaderboard='/leaderboard', Cases='/cases', Import='/import'"

        elif role == "Demo":
            persona = f"""You are the SERP Hawk CRM Demo AI Assistant — a specialist guide for THIS CRM ONLY.

CRITICAL RULE: You ONLY answer questions about SERP Hawk CRM. If the user asks ANYTHING unrelated to this CRM, politely refuse: "I can only help with SERP Hawk CRM questions."

You are demonstrating the CRM. You can navigate to any section and explain features clearly.
You CANNOT make real data changes — demo mode is view-only.
Explain what each feature does, how it helps, and guide through the UI step by step.

{CRM_KNOWLEDGE}"""
            allowed_tools = "demo"
            route_map = "Dashboard='/', Clients='/clients', Leads='/leads', Pipeline='/pipeline', Billing='/billing', Inventory='/inventory', Catalog='/catalog', Projects='/projects', Email Agent='/email-agent', Marketplace='/admin/marketplace'"

        else:
            persona = f"""You are the SERP Hawk CRM AI Assistant.

CRITICAL RULE: You ONLY answer questions about SERP Hawk CRM. Refuse all off-topic questions.

{CRM_KNOWLEDGE}"""
            allowed_tools = "minimal"
            route_map = "Dashboard='/', Clients='/clients', Leads='/leads'"

        system_prompt = f"""{persona}

{route_str}
{context_str}
{crm_summary}

ROUTE MAP (use ONLY these exact routes for navigation):
{route_map}

RESPONSE RULES:
1. ONLY answer CRM-related questions. For ANY off-topic question, say: "I can only help with SERP Hawk CRM questions. What would you like to know about the CRM?"
2. Always provide numbered step-by-step instructions when explaining how to do something
3. When the user wants to navigate somewhere, use the navigate_user tool with the correct route
4. Be concise but thorough — use bullet points and numbered steps for clarity
5. At the end of EVERY response, add: "💡 **Need help with:** [list 3 quick things you can help with]"
"""


        # ── Build tool list based on role ────────────────────────────────────
        ALL_TOOLS = [
            {
                "type": "function",
                "function": {
                    "name": "research_lead",
                    "description": "Researches a company/website using AI and creates a Lead in the CRM automatically.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "company_name": {"type": "string", "description": "Name of the company"},
                            "website": {"type": "string", "description": "Website URL of the company"}
                        },
                        "required": ["company_name"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "bulk_import_websites",
                    "description": "Scrapes and imports a list of website URLs into the CRM as new clients.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "urls": {"type": "array", "items": {"type": "string"}, "description": "List of URLs to scrape and add"}
                        },
                        "required": ["urls"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "create_client",
                    "description": "Creates a new client in the CRM manually. If the user asks to add a new client but does NOT provide a company name or URL, DO NOT call this tool. Instead, call navigate_user to '/clients?action=add'.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "company_name": {"type": "string"},
                            "website": {"type": "string"},
                            "email": {"type": "string"},
                            "phone": {"type": "string"}
                        },
                        "required": ["company_name"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "draft_email",
                    "description": "Drafts an email for a client. IMPORTANT: When you call this tool, your conversational reply MUST say 'I will redirect you to the Email Agent, where you can enter the website URL or client details to draft the email.'",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "client_id": {"type": "integer", "description": "The target client ID"},
                            "prompt": {"type": "string", "description": "Specific instructions for the email copy"}
                        },
                        "required": ["prompt"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "add_note_to_client",
                    "description": "Adds a meeting note, conversation log, or general note to a client profile.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "client_id": {"type": "integer"},
                            "content": {"type": "string"}
                        },
                        "required": ["content"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "create_deal",
                    "description": "Creates a new deal/opportunity for a client.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "client_id": {"type": "integer"},
                            "title": {"type": "string", "description": "Deal name"},
                            "value": {"type": "number", "description": "Estimated deal value in USD"},
                            "stage": {"type": "string", "description": "Stage (e.g. Lead, Negotiating, Closed Won)"}
                        },
                        "required": ["client_id", "title"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "trigger_whatsapp_support",
                    "description": "Triggers the customer support WhatsApp redirect UI.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "issue_summary": {"type": "string", "description": "Optional summary of what the user needs help with."}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "navigate_user",
                    "description": f"Teleports the user's screen to a specific page route. EXACT ROUTE MAP: {route_map}. NEVER guess a route outside this map.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "route": {"type": "string", "description": "The EXACT relative URL route from the map."}
                        },
                        "required": ["route"]
                    }
                }
            }
        ]

        TOOL_SETS = {
            "all": ALL_TOOLS,
            "sales": [t for t in ALL_TOOLS if t["function"]["name"] in (
                "research_lead", "create_client", "draft_email", "add_note_to_client",
                "create_deal", "trigger_whatsapp_support", "navigate_user"
            )],
            "employee": [t for t in ALL_TOOLS if t["function"]["name"] in (
                "add_note_to_client", "create_deal", "draft_email", "trigger_whatsapp_support", "navigate_user"
            )],
            "developer": [t for t in ALL_TOOLS if t["function"]["name"] in (
                "navigate_user", "trigger_whatsapp_support"
            )],
            "supplier": [t for t in ALL_TOOLS if t["function"]["name"] in (
                "navigate_user", "trigger_whatsapp_support"
            )],
            "demo": [t for t in ALL_TOOLS if t["function"]["name"] in (
                "navigate_user"
            )],
            "minimal": [t for t in ALL_TOOLS if t["function"]["name"] in (
                "navigate_user", "trigger_whatsapp_support"
            )],
        }

        tools = TOOL_SETS.get(allowed_tools, TOOL_SETS["minimal"])

        response = client_ai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message}
            ],
            tools=tools,
            tool_choice="auto"
        )

        msg = response.choices[0].message
        actions = []
        reply = msg.content or ""

        if msg.tool_calls:
            for tool_call in msg.tool_calls:
                args = json.loads(tool_call.function.arguments)
                actions.append({
                    "action": tool_call.function.name,
                    "parameters": args
                })

            # Generate a dynamic reply based on the actions taken if the LLM didn't provide one
            if not reply:
                names = [a["action"] for a in actions]
                reply = f"I've initiated the following actions: {', '.join(names)}."

        return {
            "actions": actions,
            "reply": reply
        }
    except Exception as e:
        print(f"Error in Omni-Agent command processing: {e}")
        return {
            "actions": [],
            "reply": "I'm sorry, my Omni-Agent processor encountered an error."
        }



def extract_client_services(website_text: str, company_name: str) -> list:
    """
    Analyzes a company's website text and extracts a structured list of services
    they OFFER — with a brief description and approximate cost estimate.
    Returns a list of dicts: [{name, brief, category, approx_cost, cost_is_estimated}]
    """
    try:
        client = get_openai_client()
        prompt = f"""You are a B2B business intelligence expert.

Analyze the following website content from "{company_name}" and extract ALL services or products this company OFFERS to their customers.

For each service:
1. Give a clean, professional service name
2. Write a 1-2 sentence brief describing what it is
3. Assign a business category from: [SEO, Web Design, Marketing, Plumbing, Legal, Accounting, Consulting, Construction, Healthcare, Real Estate, IT Services, Landscaping, Cleaning, Electrical, HVAC, Retail, Food & Beverage, Education, Finance, Transportation, Other]
4. Estimate an approximate market cost in USD. If you cannot determine the cost from the website, use your knowledge of typical market rates for this type of service.

Website content:
{website_text[:12000]}

Return ONLY valid JSON:
{{
  "services": [
    {{
      "name": "Clean service name",
      "brief": "1-2 sentence description of this service",
      "category": "One category from the list above",
      "approx_cost": 1500,
      "cost_is_estimated": true
    }}
  ]
}}

Rules:
- Extract only services/products the COMPANY OFFERS (not what they use internally)
- Include 3-10 services maximum, only the most clearly defined ones
- approx_cost should be a number in USD. Use 0 if truly impossible to estimate.
- cost_is_estimated is true unless the website explicitly states the price
"""
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        data = json.loads(response.choices[0].message.content)
        return data.get("services", [])
    except Exception as e:
        print(f"Error in extract_client_services: {e}")
        return []

def extract_client_profile_from_website(website_text: str, website_url: str) -> dict:
    """
    Analyzes website text to extract structured client profile fields.
    """
    try:
        import json
        from modules.llm_engine import get_openai_client
        client = get_openai_client()
        prompt = f"""You are a B2B CRM intelligence expert.

Analyze the following website content from "{website_url}" and extract details to populate a Client Profile.

Website content:
{website_text[:12000]}

Return ONLY valid JSON matching this structure:
{{
  "companyName": "The business name (don't use the URL)",
  "email": "Extract a contact email, or guess a generic one like info@company.com if missing",
  "tagline": "A short 5-10 word tagline or value proposition",
  "description": "A 2-3 sentence description of the company",
  "seoStrategy": "A 1-2 sentence suggested SEO strategy based on their industry",
  "targetKeywords": "A comma-separated string of 5-8 highly relevant target keywords",
  "industry": "The specific industry they operate in",
  "company_socials": {{
      "linkedin": "Company LinkedIn URL or null",
      "twitter": "Company Twitter/X URL or null",
      "instagram": "Company Instagram URL or null",
      "facebook": "Company Facebook URL or null"
  }},
  "people": [
      {{
          "name": "Person name or null",
          "role": "Job role or null",
          "email": "Email address or null",
          "phone": "Phone number or null",
          "linkedin": "Personal LinkedIn URL or null",
          "twitter": "Personal Twitter URL or null"
      }}
  ]
}}
"""
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"Error in extract_client_profile: {e}")
        return {}


def process_whatsapp_command(message: str, previous_state: dict = None, image_data: dict = None):
    """
    Analyzes an incoming WhatsApp message (or image) to determine the CRM action using OpenAI function calling.
    Supports conversational replies, CRM actions, radar search, call pitch, and client research.
    """
    try:
        client = get_openai_client()
        system_prompt = """You are *Hawk* 🦅 — a friendly, sharp, and conversational AI assistant built into the SerpHawk CRM. You work directly with the business owner via WhatsApp.

Your personality:
- Warm, professional, and efficient. Like a brilliant assistant who actually gets things done.
- Respond naturally to greetings, thank-yous, and small talk. Be brief and human.
- When a CRM action is detected, call the right tool immediately — don't ask unnecessary questions.
- Always confirm you understood voice notes by briefly echoing what you heard.

Your CRM capabilities:
1. **add_entity** — Add a Lead, Client, or Contact. Trigger on: "add john from acme", "new client xyz", "met someone named Ravi from Infosys".
2. **schedule_meeting** — Schedule a meeting/call. Trigger on: "book meeting with X tomorrow 5pm", "call Y on Monday".
3. **add_note** — Add a note to a client/lead. Trigger on: "note that X is interested", "log that Y called back".
4. **add_task** — Create a task/reminder. Trigger on: "remind me to follow up", "create task to send proposal".
5. **radar_search** — Search for competitors or research a business via radar. Trigger on: "radar on acme.com", "research competitors for X".
6. **get_call_pitch** — Get the AI call pitch for a client. Trigger on: "get pitch for X", "what do I say to Y", "call pitch for Acme".
7. **research_client** — Run AI research on a client/lead/website. Trigger on: "research X", "find info about acme.com".
8. **list_clients** — List existing clients. Trigger on: "show clients", "list clients", "how many clients do I have", "my clients".
9. **list_leads** — List existing leads. Trigger on: "show leads", "list leads", "new leads", "leads today".
10. **list_tasks** — List pending tasks. Trigger on: "show tasks", "my tasks", "pending tasks", "what do I need to do".
11. **list_upcoming_meetings** — List upcoming meetings/calls. Trigger on: "upcoming meetings", "what's on my calendar", "meetings today", "scheduled calls".
12. **get_client_summary** — Get a detailed summary of one specific client or lead. Trigger on: "tell me about Acme", "summary of Blue Barrier", "info on Ravi".
13. **assign_salesperson** — Assign a sales rep/employee to a client or lead. Trigger on: "assign Ravi to Acme", "set sales rep for Blue Barrier to Prasanth", "give Acme to John".
14. **update_lead_status** — Change the status of a lead. Trigger on: "update lead Acme to Qualified", "move Blue Barrier to Closed Won", "mark lead as Hot".
15. **update_client_status** — Change the status of a client. Trigger on: "set Acme to Hold", "mark Blue Barrier as Active", "pause Ravi's account".
16. **generate_email_draft** — Generate an AI email draft for a client or lead. Trigger on: "generate draft for Acme", "create email for Blue Barrier", "write outreach for Ravi".
17. **send_success_message** — Get the AI agent success/onboarding message or SWOT summary for a client. Trigger on: "send success message to Acme", "agent results for Blue Barrier", "get analysis for Acme".
18. **quick_followup** — Schedule a quick follow-up reminder. Trigger on: "follow up with Acme tomorrow", "remind me to call Ravi on Friday", "ping Blue Barrier next week".

Rules:
- ALWAYS call a tool if user intent matches any of the 18 actions above — no matter how informal or broken the speech-to-text is.
- Aggressively fix speech-to-text errors (e.g., "varsit adre gmail dot com" -> "varsitadre@gmail.com").
- For pure conversation (greetings, questions about CRM status, thank-yous) — respond naturally without calling any tool. Keep it brief.
- Never say "I cannot" or "I don't have access to". Just do it.
"""

        if previous_state:
            system_prompt += f"\n\nCONTEXT: User is correcting/updating a previous command.\nPrevious intent: {previous_state.get('action')}\nPrevious parameters: {previous_state.get('parameters')}\nMERGE the new message into the previous parameters, keep same tool unless explicitly changed."

        tools = [
            {
                "type": "function",
                "function": {
                    "name": "add_entity",
                    "description": "Adds a new Lead, Client, or Contact to the CRM.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string", "description": "Name of the company or person."},
                            "email": {"type": "string", "description": "Email address."},
                            "phone": {"type": "string", "description": "Phone number."},
                            "website": {"type": "string", "description": "Website URL."},
                            "notes": {"type": "string", "description": "Initial notes."}
                        },
                        "required": ["name"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "schedule_meeting",
                    "description": "Schedules a meeting or call with a lead or client.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "target_name": {"type": "string", "description": "Name of the lead/client to meet."},
                            "time_str": {"type": "string", "description": "When (e.g. 'tomorrow at 5pm', 'Monday 3pm')."},
                            "meeting_type": {"type": "string", "description": "Type: Meeting, Demo, Follow-up, Discovery. Default: Meeting."},
                            "notes": {"type": "string", "description": "Optional agenda or notes for the meeting."}
                        },
                        "required": ["target_name", "time_str"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "add_note",
                    "description": "Adds a note or update to an existing client or lead.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "target_name": {"type": "string", "description": "Name of the client or lead."},
                            "content": {"type": "string", "description": "The note content."}
                        },
                        "required": ["target_name", "content"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "add_task",
                    "description": "Creates a task or to-do in the CRM.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string", "description": "Short task title."},
                            "description": {"type": "string", "description": "Task details."},
                            "due_date": {"type": "string", "description": "Due date (e.g. 'tomorrow', 'July 20')."},
                            "priority": {"type": "string", "description": "Low, Medium, High, or Urgent."},
                            "client_name": {"type": "string", "description": "Related client name if any."}
                        },
                        "required": ["title"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "radar_search",
                    "description": "Runs a radar/competitor analysis on a website, keyword, or business type.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string", "description": "The website URL, keyword, or business niche to research."},
                            "location": {"type": "string", "description": "Optional location context."}
                        },
                        "required": ["query"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_call_pitch",
                    "description": "Retrieves or generates an AI-crafted call pitch for a specific client or lead.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "client_name": {"type": "string", "description": "Name of the client or lead to get the pitch for."}
                        },
                        "required": ["client_name"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "research_client",
                    "description": "Runs AI-powered research on a client, lead, or website and returns a summary.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string", "description": "Client/lead name or website URL to research."}
                        },
                        "required": ["query"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "list_clients",
                    "description": "Lists existing clients from the CRM. Use when the user asks to see their clients.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "status_filter": {"type": "string", "description": "Optional: filter by status (Active, Hold, Pending). Leave empty for all."},
                            "limit": {"type": "integer", "description": "Max number to return. Default 10."}
                        },
                        "required": []
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "list_leads",
                    "description": "Lists existing leads from the CRM. Use when the user asks to see their leads.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "status_filter": {"type": "string", "description": "Optional: filter by status (New, Contacted, Qualified, Closed Won, Closed Lost). Leave empty for all."},
                            "limit": {"type": "integer", "description": "Max number to return. Default 10."}
                        },
                        "required": []
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "list_tasks",
                    "description": "Lists pending or all tasks from the CRM.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "status_filter": {"type": "string", "description": "Optional: filter by status (Todo, In Progress, Done). Default: Todo and In Progress."},
                            "limit": {"type": "integer", "description": "Max number to return. Default 10."}
                        },
                        "required": []
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "list_upcoming_meetings",
                    "description": "Lists upcoming meetings and scheduled calls.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "limit": {"type": "integer", "description": "Max number to return. Default 10."}
                        },
                        "required": []
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_client_summary",
                    "description": "Gets a detailed summary/info card for a specific client or lead by name.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string", "description": "Name of the client or lead."}
                        },
                        "required": ["name"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "assign_salesperson",
                    "description": "Assigns a salesperson or employee to a client or lead.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "entity_name": {"type": "string", "description": "Name of the client or lead to assign to."},
                            "salesperson_name": {"type": "string", "description": "Name of the salesperson/employee to assign."},
                            "entity_type": {"type": "string", "description": "client or lead. Default: client."}
                        },
                        "required": ["entity_name", "salesperson_name"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "update_lead_status",
                    "description": "Updates the status of a lead (e.g., New, Contacted, Qualified, Closed Won, Closed Lost).",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "lead_name": {"type": "string", "description": "Name of the lead to update."},
                            "new_status": {"type": "string", "description": "New status: New, Contacted, Qualified, Proposal Sent, Closed Won, Closed Lost."}
                        },
                        "required": ["lead_name", "new_status"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "update_client_status",
                    "description": "Updates the status of a client (Active, Hold, Pending).",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "client_name": {"type": "string", "description": "Name of the client to update."},
                            "new_status": {"type": "string", "description": "New status: Active, Hold, Pending."}
                        },
                        "required": ["client_name", "new_status"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "generate_email_draft",
                    "description": "Generates an AI email draft for a client or lead for outreach or follow-up.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "entity_name": {"type": "string", "description": "Name of the client or lead."},
                            "context": {"type": "string", "description": "Optional: extra context for the email (e.g., 'they asked about SEO', 'follow-up after call')."}
                        },
                        "required": ["entity_name"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "send_success_message",
                    "description": "Gets the AI-generated success/onboarding summary or SWOT analysis for a client from the research agents.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "entity_name": {"type": "string", "description": "Name of the client or lead."}
                        },
                        "required": ["entity_name"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "quick_followup",
                    "description": "Creates a quick follow-up reminder or task for a client/lead.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "entity_name": {"type": "string", "description": "Name of the client or lead to follow up with."},
                            "time_str": {"type": "string", "description": "When to follow up (e.g. 'tomorrow', 'Friday', 'next week')."},
                            "note": {"type": "string", "description": "Optional reason or note for the follow-up."}
                        },
                        "required": ["entity_name", "time_str"]
                    }
                }
            }
        ]

        user_content = []
        if message:
            user_content.append({"type": "text", "text": message})

        if image_data:
            if not message:
                user_content.append({"type": "text", "text": "Please extract all details from this image (business card, ID, document) and add them to the CRM using add_entity."})
            user_content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:{image_data['mime_type']};base64,{image_data['base64']}"
                }
            })

        messages = [{"role": "system", "content": system_prompt}]
        if user_content:
            messages.append({"role": "user", "content": user_content if image_data else (message or "Hello!")})

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=tools,
            tool_choice="auto"
        )

        msg = response.choices[0].message

        if msg.tool_calls:
            tool_call = msg.tool_calls[0]
            import json as _json
            args = _json.loads(tool_call.function.arguments)
            return {
                "action": tool_call.function.name,
                "parameters": args,
                "reply": "Confirm action"
            }
        else:
            return {
                "action": "none",
                "parameters": {},
                "reply": msg.content or "Hey! I'm Hawk, your CRM assistant 🦅\n\nTry:\n• _Add lead Acme Corp_\n• _List my clients_\n• _Note that Blue Barrier is interested in SEO_\n• _Assign Ravi to Acme_\n• _Schedule meeting with Blue Barrier tomorrow 5pm_\n• Or send a voice note or business card photo!"
            }
    except Exception as e:
        print(f"Error in process_whatsapp_command: {e}")
        return {
            "action": "error",
            "parameters": {},
            "reply": "Sorry, I ran into an error. Try again in a moment! 🙏"
        }



async def generate_swot_analysis(url: str, company_name: str = "the company") -> dict:
    """
    Scrapes the given URL and uses OpenAI to generate a SWOT analysis.
    """
    from modules.scraper import scrape_website
    
    try:
        # Scrape website for context
        scraped_text = await scrape_website(url)
        if scraped_text.startswith("ERROR"):
            scraped_text = ""
        
        client = get_openai_client()
        
        context_block = ""
        if scraped_text:
            context_block = f"\n\nWEBSITE CONTENT:\n{scraped_text[:20000]}"
            
        prompt = f"""You are a top-tier business analyst. Perform a SWOT (Strengths, Weaknesses, Opportunities, Threats) analysis for {company_name} based on their website.

Website: {url}{context_block}

Return a JSON object with this exact structure:
{{
    "strengths": ["point 1", "point 2", "point 3"],
    "weaknesses": ["point 1", "point 2", "point 3"],
    "opportunities": ["point 1", "point 2", "point 3"],
    "threats": ["point 1", "point 2", "point 3"],
    "summary": "A 2-3 sentence overall strategic summary of the company."
}}

Be specific and insightful based on the scraped content. If the scraped content is missing, make reasonable inferences based on their industry or domain, but clearly state what is assumed.
"""
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.3
        )
        
        result = json.loads(response.choices[0].message.content)
        return result
    except Exception as e:
        print(f"Error generating SWOT analysis: {e}")
        return {
            "strengths": [],
            "weaknesses": [],
            "opportunities": [],
            "threats": [],
            "summary": f"Could not generate SWOT analysis. Error: {str(e)}"
        }
