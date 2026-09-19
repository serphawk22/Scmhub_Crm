import os
import json
from openai import OpenAI

def get_openai_client():
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment variables")
    return OpenAI(api_key=api_key)

def analyze_market(website_content, company_name):
    """
    Analyzes market position using OpenAI.
    """
    try:
        client = get_openai_client()
        prompt = f"""Analyze this company's market position and return a JSON object.
Company: {company_name}
Content: {website_content[:10000]}

Return JSON with fields: industry, sub_category, business_model, pain_points (list), growth_potential, online_presence (object with seo_status).
"""
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"Market analysis error: {e}")
        return {
            "industry": "General Business",
            "sub_category": "",
            "business_model": "B2B",
            "pain_points": ["Lead Generation", "Online Visibility"],
            "growth_potential": "High",
            "online_presence": {"seo_status": "Needs improvement"},
            "error": str(e)
        }

def match_services(market_analysis, company_info):
    """
    Matches SERP Hawk services using OpenAI.
    """
    try:
        client = get_openai_client()
        serp_hawk_services = "1. Organic SEO (higher Google rankings & organic traffic), 2. Local SEO (Google Maps & local dominance), 3. Google Ads (targeted PPC with measurable ROI), 4. Meta Ads (Facebook & Instagram campaigns), 5. Social Media Management (brand presence & engagement), 6. Content Marketing (SEO blogs, landing pages, conversion copy), 7. Web Development (fast, conversion-optimized sites), 8. App Development (custom mobile & web apps), 9. Automation & Consulting (smart workflows & strategy)"

        prompt = f"""You are a digital marketing strategist for SERP Hawk. Recommend the best services for {company_info.get('company_name')} based on their market analysis.

Available SERP Hawk services:
{serp_hawk_services}

Market analysis:
{json.dumps(market_analysis)[:3000]}

Return a JSON object with:
- recommended_services: list of 2-4 objects, each with:
  - service_name: exact service name from the list above
  - why_relevant: 1 sentence explaining why THIS company needs it (be specific to their industry/situation)
  - expected_impact: concrete measurable outcome (e.g., "rank on page 1 for local keywords within 90 days", "reduce cost-per-lead by 30-40%", "2x organic traffic in 6 months")
- email_hook: a compelling 1-sentence hook referencing a specific opportunity or gap you spotted for this company
- package_suggestion: Starter, Growth, or Enterprise based on their size and needs
"""
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"Service matching error: {e}")
        return {
            "recommended_services": [
                {"service_name": "Organic SEO", "why_relevant": "Improve online visibility", "expected_impact": "More qualified leads"},
                {"service_name": "Local SEO", "why_relevant": "Dominate local search", "expected_impact": "Increased local customers"}
            ],
            "email_hook": "Growth opportunities for your business",
            "package_suggestion": "Growth",
            "error": str(e)
        }
