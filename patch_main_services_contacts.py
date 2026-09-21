import re

def main():
    with open('/Users/apple/Desktop/emailagent/serphawk_crm_seo/main.py', 'r') as f:
        content = f.read()

    # Fix extracted_services
    target = '"extracted_services": [m.get("company_service") for m in mapping if m.get("company_service")]'
    replacement = '"extracted_services": [{"name": m.get("company_service"), "category": "Service", "approx_cost": 0, "cost_is_estimated": False} for m in mapping if m.get("company_service")]'

    if target in content:
        content = content.replace(target, replacement)
        with open('/Users/apple/Desktop/emailagent/serphawk_crm_seo/main.py', 'w') as f:
            f.write(content)
        print("Success patching extracted_services in main.py")
    else:
        print("Target for extracted_services not found in main.py")

if __name__ == "__main__":
    main()
