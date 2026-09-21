from sqlmodel import Session
from database import engine, MarketplaceService

def seed_inventory():
    """
    Seeds the MarketplaceService table with inventory for dapros.com.mx 
    and Serphawk/Anjali team services.
    """
    services = [
        # DaPros / Serphawk Services
        {
            "name": "Comprehensive SEO Audit",
            "category": "SEO",
            "price": 299.00,
            "description": "In-depth technical and on-page SEO audit for dapros.com.mx standard.",
            "features": "Technical Analysis, Content Gap Analysis, Backlink Audit, Actionable Report",
            "provider": "Serphawk / Anjali Team",
            "is_active": True
        },
        {
            "name": "Local SEO Optimization",
            "category": "SEO",
            "price": 499.00,
            "description": "Google My Business setup and ongoing local citation building.",
            "features": "GMB Optimization, Citation Building, Local Keyword Targeting, Monthly Reporting",
            "provider": "Serphawk / Anjali Team",
            "is_active": True
        },
        {
            "name": "Content Marketing Package - Tier 1",
            "category": "Content",
            "price": 799.00,
            "description": "High-quality, SEO-optimized blog posts and articles.",
            "features": "4 Blog Posts/mo, Keyword Research, Meta Tags, Publishing on CMS",
            "provider": "DaPros Content Team",
            "is_active": True
        },
        {
            "name": "Website Development (Next.js/React)",
            "category": "Development",
            "price": 1999.00,
            "description": "Custom modern web application development using Next.js.",
            "features": "Responsive Design, SEO Friendly, Fast Loading, Custom Features",
            "provider": "DaPros Engineering",
            "is_active": True
        },
        {
            "name": "Monthly Link Building Outreach",
            "category": "SEO",
            "price": 599.00,
            "description": "High DA backlink outreach campaigns.",
            "features": "Guest Posting, Broken Link Building, Niche Edits",
            "provider": "Serphawk Outreach Team",
            "is_active": True
        }
    ]

    with Session(engine) as session:
        for s_data in services:
            # Check if exists
            from sqlmodel import select
            existing = session.exec(select(MarketplaceService).where(MarketplaceService.name == s_data["name"])).first()
            if not existing:
                service = MarketplaceService(**s_data)
                session.add(service)
        
        session.commit()
        print("Successfully seeded inventory for dapros.com.mx and Serphawk/Anjali team.")

if __name__ == "__main__":
    seed_inventory()
