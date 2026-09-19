import re

def main():
    with open('/Users/apple/Desktop/emailagent/serphawk_crm_seo/main.py', 'r') as f:
        content = f.read()

    target_match = """        tw_match = re.search(r"Extracted Twitter Profiles:\s*(.+)", raw_text)
        if tw_match:
            scraped_twitter = tw_match.group(1).split(",")[0].strip() if tw_match.group(1).strip() else \"\""""
            
    replace_match = """        tw_match = re.search(r"Extracted Twitter Profiles:\s*(.+)", raw_text)
        if tw_match:
            scraped_twitter = tw_match.group(1).split(",")[0].strip() if tw_match.group(1).strip() else ""
            
        ig_match = re.search(r"Extracted Instagram Profiles:\s*(.+)", raw_text)
        scraped_ig = ig_match.group(1).split(",")[0].strip() if (ig_match and ig_match.group(1).strip()) else ""
        
        fb_match = re.search(r"Extracted Facebook Profiles:\s*(.+)", raw_text)
        scraped_fb = fb_match.group(1).split(",")[0].strip() if (fb_match and fb_match.group(1).strip()) else ""
        
        yt_match = re.search(r"Extracted Youtube Profiles:\s*(.+)", raw_text)
        scraped_yt = yt_match.group(1).split(",")[0].strip() if (yt_match and yt_match.group(1).strip()) else \"\""""
        
    content = content.replace(target_match, replace_match)

    target_merge = """        if scraped_twitter and not comp_twitter:
            comp_twitter = scraped_twitter"""
            
    replace_merge = """        if scraped_twitter and not comp_twitter:
            comp_twitter = scraped_twitter
        if scraped_ig and not comp_instagram:
            comp_instagram = scraped_ig
        if scraped_fb and not comp_facebook:
            comp_facebook = scraped_fb"""
            
    content = content.replace(target_merge, replace_merge)

    target_data = """                    "instagram": comp_instagram,
                    "facebook": comp_facebook
                }"""
                
    replace_data = """                    "instagram": comp_instagram,
                    "facebook": comp_facebook,
                    "youtube": scraped_yt
                }"""
                
    content = content.replace(target_data, replace_data)

    with open('/Users/apple/Desktop/emailagent/serphawk_crm_seo/main.py', 'w') as f:
        f.write(content)
    print("Success patching main.py for extra socials")

if __name__ == "__main__":
    main()
