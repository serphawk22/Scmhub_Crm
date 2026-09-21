import os
import json
from openai import OpenAI

def get_openai_client():
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment variables")
    return OpenAI(api_key=api_key)

def generate_serp_hawk_email(company_info, market_analysis, service_matches, contact=None, draft_type="outreach"):
    """
    Generates a personalized bilingual B2B email using OpenAI.
    Para 1: English | Para 2: Spanish translation
    Returns: { subject, english_body, spanish_body, body, body_html }
    """
    try:
        client = get_openai_client()
        
        company_name = company_info.get('company_name', 'your company')
        industry = market_analysis.get('industry', 'your industry')
        services = service_matches.get('recommended_services', [])[:3]
        
        service_list = ", ".join(
            svc.get('service_name', '') for svc in services
        ) if services else "growth and digital marketing"
        
        salutation = f"Hi {contact.get('name').split()[0]}," if contact and contact.get('name') else f"Hi {company_name} Team,"

        if draft_type == "inbound":
            prompt = f"""
You are a professional bilingual email copywriter for SERP Hawk, represented by Team DaPros from Mexico.

Write a professional inquiry email expressing interest in {company_name}'s services in the {industry} sector.

Salutation: {salutation}

STRUCTURE (English version):
1. Opening line — show genuine interest in their business or a recent achievement.
2. Short paragraph — mention a specific aspect of their work that caught your eye and why it makes them a great potential partner.
3. Value bridge — briefly explain how SERP Hawk helps similar companies grow (mention 1-2 relevant services from: {service_list}).
4. Soft CTA — suggest a quick 15-minute discovery call to explore synergies.
5. Sign-off: "Warm regards,\nTeam DaPros from Mexico | SERP Hawk Digital Agency"

Keep it under 150 words. Be warm, specific, and human — not salesy.

Then provide the FULL Spanish translation with identical structure, signed off as "Equipo DaPros".

Return ONLY a JSON object:
{{
    "subject": "Short, curiosity-driven subject line in English",
    "english_body": "Full English email (multiple short paragraphs separated by \\n\\n, plain text, no HTML)",
    "spanish_body": "Full Spanish translation (same structure, plain text, no HTML)"
}}
"""
        else:
            service_details = "\n".join([
                f"- {svc.get('service_name', '')}: {svc.get('why_relevant', '')} → {svc.get('expected_impact', '')}"
                for svc in services
            ]) if services else "- Organic SEO: Boost search rankings → more qualified leads\n- Local SEO: Dominate local search → increased foot traffic & calls"

            prompt = f"""
You are a world-class B2B outreach copywriter for SERP Hawk, a results-driven digital marketing agency, represented by Team DaPros from Mexico.

Write a compelling, service-focused cold outreach email to {company_name} in the {industry} industry.

Salutation: {salutation}

ABOUT SERP HAWK:
We help businesses grow revenue through data-driven digital marketing. Our full service catalog:
• Organic SEO — rank higher on Google, drive qualified organic traffic
• Local SEO — dominate Google Maps & local search results
• Google Ads — targeted PPC campaigns with measurable ROI
• Meta Ads — Facebook & Instagram ad campaigns that convert
• Social Media Management — build brand presence & engagement
• Content Marketing — SEO blogs, landing pages & conversion copy
• Web Development — fast, modern, conversion-optimized websites
• App Development — custom mobile & web applications
• Automation & Consulting — streamline operations with smart workflows

RECOMMENDED FOR {company_name.upper()}:
{service_details}

EMAIL STRUCTURE (English version — follow this exactly):
1. Hook (1-2 sentences) — Open with a specific, researched observation about {company_name}'s online presence, industry trend, or growth opportunity. Make them feel seen, not targeted.
2. Problem/Opportunity (2-3 sentences) — Identify a concrete challenge or untapped opportunity they likely face in {industry}. Be specific, not vague.
3. Service Spotlight (3-5 sentences) — For EACH recommended service ({service_list}), write one punchy sentence explaining WHAT it does for them and the RESULT they can expect. Use action verbs and concrete outcomes (e.g., "rank on page 1", "cut cost-per-lead by 40%", "3x your local visibility").
4. Social proof hint (1 sentence) — Mention that you've helped similar businesses in their space achieve measurable growth.
5. CTA (1 sentence) — Low-friction ask: a free 15-minute strategy call or audit. Make it easy to say yes.
6. Sign-off: "Warm regards,\nTeam DaPros from Mexico | SERP Hawk Digital Agency"

STYLE RULES:
- Keep total length 120-180 words. Short paragraphs (2-3 sentences max each).
- Separate paragraphs with blank lines for readability.
- Conversational and confident — like a knowledgeable friend, not a pushy salesperson.
- Every sentence must earn its place. No filler, no fluff, no generic platitudes.
- Services must be the STAR of the email — the reader should finish knowing exactly what you can do for them.

Then provide the FULL Spanish translation with identical structure, signed off as "Equipo DaPros de México | SERP Hawk Digital Agency".

Return ONLY a JSON object:
{{
    "subject": "Short, benefit-focused subject line (under 8 words, mention their company or industry)",
    "english_body": "Full English email (multiple short paragraphs separated by \\n\\n, plain text, no HTML)",
    "spanish_body": "Full Spanish translation (same structure, plain text, no HTML)"
}}
"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an elite bilingual B2B email copywriter for SERP Hawk. You write emails that are short, punchy, service-focused, and impossible to ignore. Every email must clearly spotlight the recommended services and the tangible results they deliver. Return only valid JSON with the exact fields specified."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
        english = result.get("english_body", "")
        spanish = result.get("spanish_body", "")
        combined = f"{english}\n\n{spanish}"
        
        return {
            "subject": result.get("subject", f"Growth Partnership with {company_name}"),
            "english_body": english,
            "spanish_body": spanish,
            # backward-compat keys
            "body": combined,
            "body_html": f"<p>{english}</p><p>{spanish}</p>",
        }
        
    except Exception as e:
        print(f"Error in OpenAI email generation: {e}")
        error_msg = f"Could not generate email: {str(e)}"
        return {
            "subject": f"Growth for {company_name}",
            "english_body": error_msg,
            "spanish_body": "",
            "body": error_msg,
            "body_html": f"<p>{error_msg}</p>"
        }
