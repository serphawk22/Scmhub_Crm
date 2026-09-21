import re

def main():
    with open('/Users/apple/Desktop/emailagent/serphawk_crm_seo/modules/llm_engine.py', 'r') as f:
        content = f.read()

    target = '"key_value_props": ["List of my services that best match this company (real, never prop1/prop2)"]'
    replacement = '"key_value_props": ["List of actual services or products that the scraped company provides to its customers (e.g. SEO, Web Design, Plumbing, Consulting, etc)"]'

    target2 = 'My services are: Organic SEO, Local SEO, Google Ads, Meta Ads, Social Media, Content Marketing, Web Development, App Development, Automation & Consulting.\n        Map the most relevant of these to the company based on their business.'
    replacement2 = 'For `key_value_props`, extract the ACTUAL services the company offers based on their website, do NOT output Dapros/Serphawk services.'

    if target in content and target2 in content:
        content = content.replace(target, replacement)
        content = content.replace(target2, replacement2)
        with open('/Users/apple/Desktop/emailagent/serphawk_crm_seo/modules/llm_engine.py', 'w') as f:
            f.write(content)
        print("Success patching llm_engine.py")
    else:
        print("Target not found in llm_engine.py")

if __name__ == "__main__":
    main()
