"""
Email image generator for creating beautiful branded email images.
"""
import os
import json

def generate_email_image(company_name, services, output_path):
    """
    Generates a beautiful branded email image showcasing recommended services.
    Currently uses HTML generation for branded email visuals.
    
    Args:
        company_name: Name of the target company
        services: List of recommended services with details
        output_path: Where to save the generated image
    
    Returns:
        Path to generated image or None if failed
    """
    try:
        # Prioritize HTML generation for branded email visuals
        return create_html_image(company_name, services, output_path)
    except Exception as e:
        print(f"Error generating image: {e}")
        return create_html_image(company_name, services, output_path)

def create_html_image(company_name, services, output_path):
    """
    Creates a professional HTML-based email image (Growth Report Style).
    """
    service_cards = ""
    icons = {
        "Local SEO": "📍",
        "Organic SEO": "📈",
        "Social Media Management": "📱",
        "Meta Ad Management": "🎯",
        "Google Ad Management": "🔍",
        "Digital Marketing Consulting": "💡",
        "WordPress Web Development": "💻",
        "App Development": "📲",
        "Automation Services": "⚡"
    }
    
    for idx, service in enumerate(services[:3]):
        service_name = service.get('service_name', '')
        icon = icons.get(service_name, '🚀')
        expected_impact = service.get('expected_impact', 'Growth & ROI')
        
        metric = "3x Growth"
        if "SEO" in service_name: metric = "+150% Traffic"
        elif "Ad" in service_name: metric = "4x ROAS"
        elif "Social" in service_name: metric = "+200% Engagement"
        
        service_cards += f"""
        <div class="stat-card">
            <div class="icon-box">{icon}</div>
            <div class="stat-content">
                <div class="stat-value">{metric}</div>
                <div class="stat-label">{service_name}</div>
                <div class="stat-desc">{expected_impact[:60]}...</div>
            </div>
        </div>
        """
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800&display=swap');
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{ font-family: 'Plus Jakarta Sans', sans-serif; background-color: #0f172a; color: white; }}
            .report-container {{ width: 800px; height: 450px; background: linear-gradient(145deg, #0f172a 0%, #1e293b 100%); position: relative; overflow: hidden; padding: 40px; display: flex; flex-direction: column; justify-content: space-between; }}
            .glow-orb {{ position: absolute; width: 300px; height: 300px; background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(0,0,0,0) 70%); border-radius: 50%; top: -100px; right: -100px; }}
            .glow-orb-2 {{ position: absolute; width: 400px; height: 400px; background: radial-gradient(circle, rgba(168, 85, 247, 0.1) 0%, rgba(0,0,0,0) 70%); border-radius: 50%; bottom: -150px; left: -150px; }}
            .header-row {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; position: relative; z-index: 2; }}
            .brand {{ display: flex; align-items: center; gap: 12px; }}
            .logo-icon {{ background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); }}
            .brand-name {{ font-weight: 800; font-size: 20px; letter-spacing: -0.5px; background: linear-gradient(to right, #fff, #cbd5e1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }}
            .report-badge {{ background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.1); padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; color: #94a3b8; backdrop-filter: blur(10px); }}
            .main-content {{ position: relative; z-index: 2; }}
            .title-area {{ margin-bottom: 40px; }}
            h1 {{ font-size: 36px; font-weight: 800; line-height: 1.2; margin-bottom: 12px; }}
            .highlight {{ color: #818cf8; }}
            .subtitle {{ font-size: 16px; color: #94a3b8; max-width: 500px; }}
            .stats-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }}
            .stat-card {{ background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255, 255, 255, 0.05); padding: 20px; border-radius: 16px; backdrop-filter: blur(10px); }}
            .icon-box {{ margin-bottom: 12px; font-size: 24px; }}
            .stat-value {{ font-size: 20px; font-weight: 700; color: white; margin-bottom: 4px; }}
            .stat-label {{ font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }}
            .stat-desc {{ font-size: 11px; color: #64748b; line-height: 1.4; }}
            .footer {{ border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 20px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b; position: relative; z-index: 2; }}
            .cta-hint {{ color: #818cf8; font-weight: 600; display: flex; align-items: center; gap: 6px; }}
        </style>
    </head>
    <body>
        <div class="report-container">
            <div class="glow-orb"></div>
            <div class="glow-orb-2"></div>
            <div class="header-row">
                <div class="brand"><div class="logo-icon">🦅</div><div class="brand-name">SERP HAWK</div></div>
                <div class="report-badge">GROWTH PREVIEW</div>
            </div>
            <div class="main-content">
                <div class="title-area">
                    <h1>Growth Strategy for <br><span class="highlight">{company_name}</span></h1>
                    <div class="subtitle">We identified 3 key opportunities to accelerate your digital presence and revenue.</div>
                </div>
                <div class="stats-grid">{service_cards}</div>
            </div>
            <div class="footer"><div>Prepared by AI Analysis Engine</div><div className="cta-hint">View Full Strategy →</div></div>
        </div>
    </body>
    </html>
    """
    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else '.', exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    return output_path
