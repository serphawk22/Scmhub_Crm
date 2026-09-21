import re

def main():
    with open('/Users/apple/Desktop/emailagent/serphawk_crm_seo/main.py', 'r') as f:
        content = f.read()

    target = """        # Extract Emails and Phones from analysis (which llm might not put in contacts)
        extracted_emails = email
        extracted_phones = phone"""

    replacement = """        # Extract Emails, Phones, and Socials from scraper raw text
        raw_text = result.get("raw_text", "")
        import re
        scraped_emails = []
        scraped_phones = []
        scraped_linkedin = ""
        scraped_twitter = ""
        
        email_match = re.search(r"Extracted Emails:\s*(.+)", raw_text)
        if email_match:
            scraped_emails = [e.strip() for e in email_match.group(1).split(",") if e.strip()]
            
        phone_match = re.search(r"Extracted Phone Numbers:\s*(.+)", raw_text)
        if phone_match:
            scraped_phones = [p.strip() for p in phone_match.group(1).split(",") if p.strip()]
            
        li_match = re.search(r"Extracted LinkedIn Profiles:\s*(.+)", raw_text)
        if li_match:
            scraped_linkedin = li_match.group(1).split(",")[0].strip() if li_match.group(1).strip() else ""
            
        tw_match = re.search(r"Extracted Twitter Profiles:\s*(.+)", raw_text)
        if tw_match:
            scraped_twitter = tw_match.group(1).split(",")[0].strip() if tw_match.group(1).strip() else ""

        # Merge with LLM findings
        if email and email not in scraped_emails:
            scraped_emails.append(email)
        if phone and phone not in scraped_phones:
            scraped_phones.append(phone)
            
        extracted_emails = scraped_emails if scraped_emails else ""
        extracted_phones = scraped_phones if scraped_phones else ""
        
        if scraped_linkedin and not comp_linkedin:
            comp_linkedin = scraped_linkedin
        if scraped_twitter and not comp_twitter:
            comp_twitter = scraped_twitter
"""

    if target in content:
        content = content.replace(target, replacement)
        with open('/Users/apple/Desktop/emailagent/serphawk_crm_seo/main.py', 'w') as f:
            f.write(content)
        print("Success patching main.py")
    else:
        print("Target not found in main.py")

if __name__ == "__main__":
    main()
