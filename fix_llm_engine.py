import re

filepath = 'modules/llm_engine.py'
with open(filepath, 'r') as f:
    content = f.read()

# Let's replace the prompt in analyze_content
old_prompt = """        You are an expert business analyst and OSINT researcher. Given the following website text, do real research (using your knowledge and reasoning) and return a JSON object with:
        {{
            "company_name": "The real name of the company (never a placeholder)",
            "what_they_do": "A real, concise summary of what this company does (2-3 sentences, never a template)",
            "company_social_media": {{
                "linkedin": "Company LinkedIn URL or null",
                "twitter": "Company Twitter/X URL or null",
                "instagram": "Company Instagram URL or null",
                "facebook": "Company Facebook URL or null"
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
        }}"""

new_prompt = """        You are an expert business analyst and OSINT researcher. Given the following website text, do real research (using your knowledge and reasoning) and return a JSON object with:
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
        }}"""

content = content.replace(old_prompt, new_prompt)

with open(filepath, 'w') as f:
    f.write(content)

print("Updated prompt in llm_engine.py")
