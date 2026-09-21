import re

def main():
    with open('/Users/apple/Desktop/emailagent/serphawk_crm_seo/modules/scraper.py', 'r') as f:
        content = f.read()

    # 1. Add sets
    if 'found_instagram = set()' not in content:
        content = content.replace('found_twitter = set()', 'found_twitter = set()\n    found_instagram = set()\n    found_facebook = set()\n    found_youtube = set()')

    # 2. Add logic to extract
    target_extract = """                # Twitter/X extraction - multiple domain variations
                if any(domain in lower_href for domain in ['twitter.com/', 'x.com/', 'twitter.com/intent']):
                    twitter_url = href.split('?')[0].split(';')[0].strip()
                    if twitter_url and '/intent' not in lower_href:  # Skip intent links
                        found_twitter.add(twitter_url)"""
    
    replace_extract = """                # Twitter/X extraction - multiple domain variations
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
                    if yt_url: found_youtube.add(yt_url)"""
                    
    content = content.replace(target_extract, replace_extract)

    # 3. Add to final_content
    target_combine = """    all_twitter = sorted(list(found_twitter))"""
    replace_combine = """    all_twitter = sorted(list(found_twitter))
    all_instagram = sorted(list(found_instagram))
    all_facebook = sorted(list(found_facebook))
    all_youtube = sorted(list(found_youtube))"""
    content = content.replace(target_combine, replace_combine)

    target_return = """        f"Extracted Twitter Profiles: {', '.join(all_twitter)}\\n\\n\""""
    replace_return = """        f"Extracted Twitter Profiles: {', '.join(all_twitter)}\\n"
        f"Extracted Instagram Profiles: {', '.join(all_instagram)}\\n"
        f"Extracted Facebook Profiles: {', '.join(all_facebook)}\\n"
        f"Extracted Youtube Profiles: {', '.join(all_youtube)}\\n\\n\""""
    content = content.replace(target_return, replace_return)

    with open('/Users/apple/Desktop/emailagent/serphawk_crm_seo/modules/scraper.py', 'w') as f:
        f.write(content)
    print("Success patching scraper.py")

if __name__ == "__main__":
    main()
