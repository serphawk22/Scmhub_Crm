# --- Dapros Service Mapping and Research ---
import json
from modules.llm_engine import analyze_content

# Dapros services (can be loaded from DB/config in future)
DAPROS_SERVICES = [
    "Local and Organic SEO",
    "PPC Advertising",
    "Web Development",
    "Artificial intelligence",
    "Ecommerce",
    "Secure Hosting"
]

def map_services_to_dapros(company_services, dapros_services=DAPROS_SERVICES):
    """
    Use OpenAI to map company services to dapros services.
    """
    # Compose a prompt for mapping
    prompt = f"""
    You are an expert B2B analyst. Given the following list of company services and Dapros's services, map each company service to the most relevant Dapros service (or 'None' if no match). Return a JSON object with a "mappings" key containing a list of objects like:
    {{"mappings": [{{"company_service": "...", "dapros_service": "..."}}]}}

    Company Services: {json.dumps(company_services)}
    Dapros Services: {json.dumps(dapros_services)}
    """
    from modules.llm_engine import get_openai_client
    client = get_openai_client()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    result = json.loads(response.choices[0].message.content)
    return result.get("mappings", [])

async def research_and_map_company(url, dapros_services=DAPROS_SERVICES):
    """
    Scrape a company website, analyze with OpenAI, and map their services to Dapros's.
    Returns: dict with analysis, mapping, and suggested inbound/outbound requests.
    """
    website_text = await scrape_website(url)
    if website_text.startswith("ERROR"):
        # Infer company name from URL
        from urllib.parse import urlparse
        domain = urlparse(url).netloc or urlparse('https://' + url if not url.startswith('http') else url).netloc
        comp_name = domain.replace("www.", "").split(".")[0].capitalize()
        logger.info(f"Scraping failed/blocked. Triggering LLM fallback for {comp_name}")
        from modules.fallback_analyzer import analyze_company_name_fallback
        analysis = analyze_company_name_fallback(comp_name)
    else:
        analysis = analyze_content(website_text)
    # Try to extract company services from analysis (fallback to empty list)
    company_services = analysis.get("key_value_props") or []
    mapping = map_services_to_dapros(company_services, dapros_services)
    # Suggest inbound/outbound requests
    prompt = f"""
    Given the following mapping between a company's services and Dapros's services, suggest:
    - 2 outbound service requests (Dapros to company)
    - 2 inbound service requests (company to Dapros)
    Return as JSON: {{"outbound": [..], "inbound": [..]}}

    Mapping: {json.dumps(mapping)}
    Dapros Services: {json.dumps(dapros_services)}
    """
    from modules.llm_engine import get_openai_client
    client = get_openai_client()
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    suggestions = json.loads(resp.choices[0].message.content)
    return {
        "company_analysis": analysis,
        "service_mapping": mapping,
        "suggested_requests": suggestions,
        "raw_text": website_text
    }
import re
import requests
from bs4 import BeautifulSoup
import logging
from urllib.parse import urljoin, urlparse

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def scrape_website(url):
    """
    Fetches the website content, extracts contact emails/phones from homepage
    and related contact/about pages, and compiles the info.
    """
    # Ensure URL has schema
    if not url.startswith('http'):
        url = 'https://' + url
        
    logger.info(f"Scraping URL: {url}")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    }
    
    email_pattern = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
    # Enhanced phone pattern - catches international formats, with/without +, with/without separators
    phone_pattern = re.compile(
        r'(?:\+\d{1,4}[-.\s]?)?\(?\d{2,5}\)?[-.\s]?\d{2,5}[-.\s]?\d{3,5}(?:[-.\s]?\d{3,5})?|\+\d{10,15}|(?:tel:|phone:|mobile:)[-\s]*[+]?[\d\s().-]{10,20}'
    )

    found_emails = set()
    found_phones = set()
    found_linkedin = set()
    found_twitter = set()
    found_instagram = set()
    found_facebook = set()
    found_youtube = set()
    scraped_texts = []

    def clean_phone(phone_str):
        # Remove common false positives like version numbers, CSS parameters, or very short strings
        cleaned = re.sub(r'[^\d+]', '', phone_str)
        # Phone numbers should have between 7 and 15 digits
        if len(cleaned) >= 7 and len(cleaned) <= 15:
            # Avoid matching standard dates/versions (e.g. 2026-05-30 or 1.2.3.4)
            if not re.match(r'^\d{4}-\d{2}-\d{2}$', phone_str.strip()):
                return phone_str.strip()
        return None

    def extract_from_html(html_content, page_url):
        # 1. Regex search on raw HTML (before parsing) to catch mailto/tel and plain text matches
        for email in email_pattern.findall(html_content):
            found_emails.add(email)
        
        # Priority: Look for professional contact emails (contact@, sales@, hello@, etc.)
        priority_email_patterns = [
            r'(?:contact|hello|reach|inquiry|business|partnership|sales|support)[@\s]*:?[@\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})',
            r'"([a-zA-Z0-9._%+-]*(?:contact|hello|reach|inquiry|business|partnership|sales|support)[a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})"',
            r'\b(?:contact|hello|reach|sales|hello|info|inquiry)@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b'
        ]
        for pattern in priority_email_patterns:
            for match in re.finditer(pattern, html_content, re.IGNORECASE):
                # Extract the email from group 1 if it exists, otherwise use the full match
                email = match.group(1) if match.lastindex else match.group(0)
                email = re.sub(r'["\'\s:]+', '', email).lower()
                if email_pattern.match(email):
                    found_emails.add(email)
            
        # Extract from href="mailto:..." and href="tel:..."
        temp_soup = BeautifulSoup(html_content, 'html.parser')
        for a in temp_soup.find_all('a', href=True):
            href = a['href'].strip()
            if href.lower().startswith('mailto:'):
                email = href[7:].split('?')[0].strip()
                if email_pattern.match(email):
                    found_emails.add(email)
            elif href.lower().startswith('tel:'):
                phone = href[4:].split('?')[0].strip()
                # Clean and add
                cleaned = clean_phone(phone)
                if cleaned:
                    found_phones.add(cleaned)
            else:
                lower_href = href.lower()
                # LinkedIn extraction - company and personal profiles
                if 'linkedin.com/' in lower_href:
                    linkedin_url = href.split('?')[0].split(';')[0].strip()
                    if linkedin_url:
                        found_linkedin.add(linkedin_url)
                # Twitter/X extraction - multiple domain variations
                if any(domain in lower_href for domain in ['twitter.com/', 'x.com/', 'twitter.com/intent']):
                    twitter_url = href.split('?')[0].split(';')[0].strip()
                    if twitter_url and '/intent' not in lower_href:  # Skip intent links
                        found_twitter.add(twitter_url)
                # Instagram extraction
                if 'instagram.com/' in lower_href:
                    ig_url = href.split('?')[0].split(';')[0].strip()
                    if ig_url: found_instagram.add(ig_url)
                # Facebook extraction
                if 'facebook.com/' in lower_href:
                    fb_url = href.split('?')[0].split(';')[0].strip()
                    if fb_url: found_facebook.add(fb_url)
                # Youtube extraction
                if 'youtube.com/' in lower_href or 'youtu.be/' in lower_href:
                    yt_url = href.split('?')[0].split(';')[0].strip()
                    if yt_url: found_youtube.add(yt_url)

        # 2. Extract plain text phone numbers
        # Clean soup script and style elements to avoid extracting numbers from Javascript/CSS
        for element in temp_soup(["script", "style", "noscript", "iframe", "svg"]):
            element.decompose()
            
        text_content = temp_soup.get_text(separator=' ')
        
        # Priority phone patterns (contact/support/sales numbers)
        priority_patterns = [
            r'(?:call us|phone|contact|support|sales|hello|reach us)[\s:]*([+]?[\d\s().-]{10,20})',
            r'(?:ph|mobile|whatsapp|tel|telephone)[\s:]*([+]?[\d\s().-]{10,20})'
        ]
        for pattern in priority_patterns:
            for match in re.finditer(pattern, text_content, re.IGNORECASE):
                phone = match.group(1).strip()
                cleaned = clean_phone(phone)
                if cleaned:
                    found_phones.add(cleaned)
        
        # General phone number extraction
        for phone in phone_pattern.findall(text_content):
            cleaned = clean_phone(phone)
            if cleaned:
                # Further validate that it's not a common false positive
                if not re.match(r'^\d+\.\d+$', cleaned) and not re.match(r'^[0-9\s.-]+$', cleaned) == False:
                    # Let's ensure it has at least some spaces, hyphens, or a + to distinguish from plain large ints
                    if any(c in cleaned for c in ['+', '-', ' ', '(', ')']) or len(cleaned.strip()) >= 10:
                        found_phones.add(cleaned.strip())
        
        # Clean whitespace for display text
        lines = (line.strip() for line in text_content.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        clean_text = '\n'.join(chunk for chunk in chunks if chunk)
        return clean_text

    response_text = ""
    markdown_text = ""
    import os
    firecrawl_key = os.getenv("FIRECRAWL_API_KEY")
    
    def fetch_page(target_url, timeout=12):
        if firecrawl_key:
            try:
                logger.info(f"Using Firecrawl for {target_url}")
                resp = requests.post(
                    "https://api.firecrawl.dev/v1/scrape",
                    headers={"Authorization": f"Bearer {firecrawl_key}", "Content-Type": "application/json"},
                    json={"url": target_url, "formats": ["markdown", "html"]},
                    timeout=30
                )
                if resp.status_code == 200:
                    data = resp.json().get("data", {})
                    return data.get("html", ""), data.get("markdown", "")
            except Exception as e:
                logger.error(f"Firecrawl failed for {target_url}: {e}, falling back to requests")
        
        # Fallback
        resp = requests.get(target_url, headers=headers, timeout=timeout)
        resp.raise_for_status()
        return resp.text, ""

    try:
        response_text, markdown_text = fetch_page(url)
    except Exception as e:
        if url.startswith('https://'):
            http_url = 'http://' + url[8:]
            logger.info(f"Https failed, retrying http: {http_url}")
            try:
                response_text, markdown_text = fetch_page(http_url)
                url = http_url
            except Exception as e_inner:
                logger.error(f"Failed to scrape {url}: {e_inner}")
                return f"ERROR SCRAPING: {str(e)}"
        else:
            logger.error(f"Failed to scrape {url}: {e}")
            return f"ERROR SCRAPING: {str(e)}"

    # Check if the page is a WAF challenge or empty response
    is_blocked = False
    status_code = 200
    if status_code in [202, 403, 503, 429]:
        is_blocked = True
    elif not response_text or len(response_text.strip()) < 200:
        is_blocked = True
    else:
        # Check for typical anti-bot signature keywords in HTML
        lower_html = response_text.lower()
        anti_bot_signatures = [
            'bm-verify', 'akamai', 'cloudflare', 'captcha', 'sucuri', 
            'incapsula', 'shield', 'please enable javascript', 
            'interstitial', 'security challenge', 'bot verification',
            'ddos-guard', 'access denied', 'unusual activity'
        ]
        if any(sig in lower_html for sig in anti_bot_signatures):
            is_blocked = True

    if is_blocked:
        logger.warning(f"Scraping blocked by security challenge/WAF for {url}")
        return f"ERROR: Scraping blocked by security challenge or WAF on {url} (HTTP {status_code})"

    # Extract from homepage
    homepage_text = extract_from_html(response_text, url)
    if markdown_text:
        scraped_texts.append(markdown_text)
    else:
        scraped_texts.append(homepage_text)

    # 3. Contact Page Discovery
    contact_links = []
    try:
        soup = BeautifulSoup(response_text, 'html.parser')
        keywords = ['contact', 'about', 'reach', 'info', 'support', 'help', 'career', 'team', 'our-team', 'staff', 'people', 'leadership', 'management', 'board', 'sales', 'inquiry', 'business', 'partnership']
        seen_urls = set()
        for a in soup.find_all('a', href=True):
            href = a['href'].strip()
            text = a.get_text().lower()
            href_lower = href.lower()
            
            is_contact = any(kw in href_lower or kw in text for kw in keywords)
            if is_contact and not href_lower.startswith(('mailto:', 'tel:', 'javascript:', '#')):
                full_url = urljoin(url, href)
                parsed_base = urlparse(url)
                parsed_full = urlparse(full_url)
                if parsed_full.netloc == parsed_base.netloc or not parsed_full.netloc:
                    if full_url not in seen_urls and full_url != url:
                        seen_urls.add(full_url)
                        contact_links.append(full_url)
    except Exception as e:
        logger.error(f"Error parsing contact links: {e}")

    # Scrape top contact/about pages for contact info
    for link in contact_links[:5]:  # Increased from 3 to 5 pages
        logger.info(f"Scraping contact/about subpage: {link}")
        try:
            sub_resp_text, sub_markdown = fetch_page(link, timeout=6)
            if sub_resp_text:
                sub_text = extract_from_html(sub_resp_text, link)
                # Keep more text for better extraction (15000 chars instead of 5000)
                if sub_markdown:
                    scraped_texts.append(sub_markdown[:15000])
                else:
                    scraped_texts.append(sub_text[:15000])
        except Exception as e:
            logger.error(f"Failed to scrape subpage {link}: {e}")

    # Combine everything
    all_emails = sorted(list(found_emails))
    all_phones = sorted(list(found_phones))
    all_linkedin = sorted(list(found_linkedin))
    all_twitter = sorted(list(found_twitter))
    all_instagram = sorted(list(found_instagram))
    all_facebook = sorted(list(found_facebook))
    all_youtube = sorted(list(found_youtube))

    # Keep unique paragraphs
    combined_website_text = "\n\n".join(scraped_texts)
    
    final_content = (
        f"Source URL: {url}\n\n"
        f"Extracted Emails: {', '.join(all_emails)}\n"
        f"Extracted Phone Numbers: {', '.join(all_phones)}\n"
        f"Extracted LinkedIn Profiles: {', '.join(all_linkedin)}\n"
        f"Extracted Twitter Profiles: {', '.join(all_twitter)}\n"
        f"Extracted Instagram Profiles: {', '.join(all_instagram)}\n"
        f"Extracted Facebook Profiles: {', '.join(all_facebook)}\n"
        f"Extracted Youtube Profiles: {', '.join(all_youtube)}\n\n"
        f"Website Content:\n{combined_website_text[:15000]}"
    )
    return final_content
