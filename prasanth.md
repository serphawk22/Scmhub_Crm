backend
cd p:\SERPHewk\serphawk_crm_seo-main
.venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

frontend
cd p:\SERPHewk\serphawk_crm_seo-main\frontend
npm run dev

Admin Credentials:
Email: admin@example.com
Password: Admin@123

<!-- npx ngrok http 8000 -->

# --- Email Agent UI Settings ---
# To manually change the default 'From' email address (currently set to crm@serphawk.in):
# Open the file: frontend/src/app/email-agent/page.tsx
# Go to line ~226 and edit this exact code:
# const [fromEmail, setFromEmail] = useState("crm@serphawk.in");

---

# 🚀 Webhook Response & Gmail Agent Updates (August 8, 2026)

We have successfully integrated the new N8N webhook payload into the CRM Gmail Agent so that all extracted information is presented perfectly in the UI.

## What changed and where:

### 1. Backend Code Updates in [main.py](file:///p:/SERPHewk/serphawk_crm_seo-main/main.py)
* **List Unpacking:** N8N webhook returns results wrapped inside a list (like `[ { ... } ]`). The code now automatically checks if the response is a list, and unpacks the first item so that it doesn't crash or fail to parse.
* **Email Mapping:** Mapped `primary_email` to the main prospect contact email and `all_emails` to the list of extracted emails.
* **Phone Mapping:** Mapped `primary_phone` to the main contact phone number and `all_phones` list to a comma-separated string for extracted phone numbers.
* **Social Links Handling:** Safely handles the `social_links` object where each platform contains a list of links (e.g. `instagram: []`). It grabs the first link if available and maps it to the frontend's expected format.
* **Services Offered:** Mapped `company_services` list directly to the recommended services and generated catalog services.
* **Reference URLs:** Extracted `source_pages` (the list of URLs crawled) and passed it to the frontend inside `company_info` as `source_pages`.

### 2. Frontend Code Updates in [page.tsx](file:///p:/SERPHewk/serphawk_crm_seo-main/frontend/src/app/email-agent/page.tsx)
* **TypeScript Interface Update:** Updated the `ResearchResultData` interface to define `source_pages?: string[]` and modified `extracted_emails` to support lists or strings without compiler/linter errors.
* **New UI Component:** Added a beautiful reference card under the **Extracted Company Info** section called **Source Pages / Reference URLs**. This card lists all crawled web pages with a Globe icon and direct clickable links.

### 3. Environment Config Updates in [.env](file:///p:/SERPHewk/serphawk_crm_seo-main/.env)
* **Production Webhook Switch:** Discovered that the N8N webhook was failing because the CRM was configured to hit the test webhook endpoint (`/webhook-test/trigger-cold-email`). Changed it to the active production endpoint (`/webhook/trigger-cold-email`) for both email and vapi agents, which ensures the CRM receives data correctly even when the N8N editor is closed.

### 4. UI Customization Updates (August 8, 2026 - Phase 2)
* **Removed Source Pages:** Removed the **Source Pages / Reference URLs** section/card entirely from the frontend.
* **Copyable Email Text Boxes:** Changed the "Emails" list inside the **Extracted Company Info** section. The emails are no longer clickable hyperlinks. Instead, each email is presented inside a clean text box with a dedicated "Copy" button so you can copy the email address with one click.
* **Monochrome Services Offered:** Refactored the **Services Offered by This Company** container to use a clean **black-and-white color palette** (matching the premium minimalist theme of the CRM) instead of the previous green/emerald color theme.

### 5. Automated Mail Updates (August 15, 2026)
* **Removed Send Mail Automatically Button:** Modified `frontend/src/app/email-agent/page.tsx` (Lines 657-665) by removing the `Send Automatically` button and its associated loading animation. The mail is now sent automatically when searching for a company via the N8N webhook trigger.
* **Mail Sent Animation:** Added a new animation component in the same container (Lines 657-667 of `frontend/src/app/email-agent/page.tsx`) that displays a "Mail Sent Automatically via AI" success message directly after the information is generated. The color palette (`emerald-500`) has been maintained to match the existing successful states throughout the page.

### 6. Data Parsing & Tracking Updates (August 15, 2026 - Phase 2)
* **Webhook Array Parsing & Test Data Removal:** Updated `main.py` (Lines 314-321) to intelligently scan the array returned by N8N to locate the dictionary containing the actual company information, preventing it from incorrectly grabbing a status object (like "Mail Sent"). Also stripped out the dummy "test@example.com" fallbacks from `main.py` so that only real data is presented to the UI.
* **Source Pages & YouTube Restoration:** Re-added the **Source Pages / Reference URLs** UI container in `frontend/src/app/email-agent/page.tsx` (Line ~571) so the agent clearly displays the crawled URLs. Additionally, mapped the `youtube` field in the backend and successfully added a dedicated YouTube social button to the frontend's social links array.
* **Email Tracking Deletion Feature:** Added a `DELETE /sent-emails/{email_id}` endpoint in `main.py` and connected it to a new **Delete** (Trash2 icon) button in the Recent Email Outreach table inside `frontend/src/app/email-agent/page.tsx`, allowing users to permanently remove test/historical emails from the CRM.