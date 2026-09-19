import os
import json
from openai import OpenAI

def get_openai_client():
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment variables")
    return OpenAI(api_key=api_key)

def analyze_company_name_fallback(company_name):
    """
    Deep company analysis using GPT's knowledge base when website scraping fails.
    Returns a rich company_info dict ready for email personalization.
    """
    try:
        client = get_openai_client()
        prompt = f"""You are a business intelligence researcher with deep knowledge of companies worldwide.

Analyze the company: "{company_name}"

Use your knowledge about this company to return highly accurate, specific details.
DO NOT make up data. If the company is well-known (e.g. Flipkart, Amazon, Zomato, BookMyShow),
use your actual knowledge of their real products, services, and business model.

Return a JSON object with these exact fields:
{{
    "company_name": "The real, properly-formatted company name",
    "summary": "3-5 sentence description of what the company actually does, their market position, and key differentiators",
    "what_they_do": "Concise 1-sentence description of their core business",
    "likely_industry": "Specific industry (e.g. 'E-commerce & Retail', 'Food Delivery', 'Entertainment & Ticketing')",
    "sub_category": "More specific sub-category",
    "business_model": "B2C / B2B / Marketplace / SaaS / etc.",
    "key_products_services": ["List of their actual key products or services (3-6 items)"],
    "target_market": "Who their customers are",
    "estimated_size": "Startup / SMB / Mid-Market / Enterprise / Large Corporation",
    "geographic_presence": "Local / National / International",
    "common_pain_points": ["3-4 growth challenges this type of company typically faces that SEO / digital marketing can solve"],
    "growth_opportunities": ["2-3 specific areas where SERP Hawk's SEO and digital services could help them grow"],
    "contacts": [
        {{
            "name": "If you know a real contact name (e.g. key executive), otherwise null",
            "role": "Their role or null",
            "email": "A real or highly likely business contact email address (e.g., partnerships@domain.com, info@domain.com)",
            "phone_number": "A real or highly likely business contact phone number with country code, or null"
        }}
    ]
}}

Be specific and accurate. If this is a major brand (like Flipkart, Zomato, etc.), describe their real products and services."""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a business intelligence expert. Return accurate, specific company analysis in valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        result = json.loads(response.choices[0].message.content)
        # Always ensure these keys exist
        result.setdefault('company_name', company_name)
        result.setdefault('contacts', [])
        result.setdefault('summary', f'{company_name} is a company in the digital space.')
        return result
    except Exception as e:
        return {
            "company_name": company_name,
            "likely_industry": "General Business",
            "sub_category": "",
            "business_model": "B2B",
            "common_pain_points": ["Lead Generation", "Online Visibility"],
            "growth_opportunities": ["Organic Search Traffic", "Local Discovery"],
            "key_products_services": [],
            "target_market": "General consumers and businesses",
            "summary": f"{company_name} is a business looking to grow its digital presence.",
            "contacts": [],
            "error": str(e)
        }
