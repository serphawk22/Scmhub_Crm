from database import engine, User, ClientProfile
from sqlmodel import Session, select

clients_data = [
    {
        "companyName": "ALLYTECH Services",
        "websiteUrl": "https://allytechservices.in/",
        "email": "info.allytech@gmail.com",
        "projectName": "Software Training Institute",
        "gmbName": "AllyTech- Adv. Excel & Macros / Data Science / SAP Training in btm Bannerghatta Rd Jayanagar",
        "seoStrategy": "Organic ranking",
        "targetKeywords": ["Power BI Training in Bangalore", "Python Class Near me", "Python Coaching Classes Near me", "Python Institutes Near me", "Advanced Excel Training in bangalore", "SQL Training in Bangalore"]
    },
    {
        "companyName": "ERP Class",
        "websiteUrl": "https://erpclass.com/",
        "email": "info@erpclass.com",
        "projectName": "Software Training Institute",
        "gmbName": "SAP Training BTM",
        "seoStrategy": "Local & organic ranking",
        "targetKeywords": ["SAP MM Training in BTM 1st Stage", "SAP MM Training in BTM 2nd Stage", "SAP MM Training in Bannerghatta", "SAP MM Training in JP Nagar", "SAP MM Training in Jayanagar"]
    },
    {
        "companyName": "DATASCIENCE",
        "websiteUrl": "https://datascience-training.in",
        "email": "info.allytech@gmail.com",
        "projectName": "Software Training Institute",
        "gmbName": "",
        "seoStrategy": "Only organic (GMB merged as duplicate)",
        "targetKeywords": ["Datascience training in BTM"]
    },
    {
        "companyName": "AZURE TRAINING",
        "websiteUrl": "https://azuretraining.co.in",
        "email": "info.allytech@gmail.com",
        "projectName": "Software Training Institute",
        "gmbName": "",
        "seoStrategy": "Local & organic ranking",
        "targetKeywords": ["Azure Training in BTM"]
    },
    {
        "companyName": "Lovely Med Spa",
        "websiteUrl": "https://lovely-medspa.online",
        "email": "",
        "projectName": "",
        "gmbName": "Best Spa in Jeevan Bhima Nagar | Lovely Med Spa",
        "seoStrategy": "On Hold",
        "targetKeywords": ["Spa in Jeevan Bhima Nagar"]
    },
    {
        "companyName": "TIM",
        "websiteUrl": "https://traininginstitutemarathahalli.in/",
        "email": "ayaz@riainstitute.in",
        "projectName": "Software Training Institute",
        "gmbName": "Training Institute Marathahalli-Python, Data Science, Selenium, Java, SQL, Excel Courses",
        "seoStrategy": "Local & organic ranking",
        "targetKeywords": ["Python training in Marathahalli", "Tally Coaching classes near me", "Tally GST classes near me", "Tally course Classes Near me"]
    },
    {
        "companyName": "MADDAPPATTU",
        "websiteUrl": "https://madappattuhostels.online/",
        "email": "",
        "projectName": "Hostel / PG Accomodation",
        "gmbName": "Madappattu Hostels | Ladies Hostel | Gents Hostel | Near Infopark, Kakkanad",
        "seoStrategy": "Local & organic ranking",
        "targetKeywords": ["Hostels near info Park", "Ladies hostel near info park Phase 2"]
    },
    {
        "companyName": "Spoken English Courses",
        "websiteUrl": "https://spokenenglishcourses.in/",
        "email": "ayaz@riainstitute.in",
        "projectName": "Language Training Institute",
        "gmbName": "Spoken English Courses | Marathahalli | Bangalore",
        "seoStrategy": "Local & organic ranking",
        "targetKeywords": ["Spoken English classes in Marathahalli", "Spoken English classes in Bangalore"]
    },
    {
        "companyName": "PREPSTROM",
        "websiteUrl": "https://prepstrom.com/",
        "email": "training@prepstrom.com",
        "projectName": "Language Training Institute",
        "gmbName": "PrepStrom- Best IELTS | PTE | French | German | Spanish Training Institute in Marathahalli",
        "seoStrategy": "Local & organic ranking",
        "targetKeywords": ["IELTS Coaching in Bangalore Near Me", "IELTS Coaching in Bangalore", "Best IELTS Coaching in Bangalore", "IELTS training in bangalore"]
    },
    {
        "companyName": "ECS Technologies",
        "websiteUrl": "https://ecstechno.in",
        "email": "info@ecstechno.in",
        "projectName": "Mobile Repair Training Institute",
        "gmbName": "ECS Technologies - Mobile/iPhone/Laptop repair training institute Hyderabad",
        "seoStrategy": "Local & organic ranking",
        "targetKeywords": ["Mobile repair courses in Hyderabad", "Mobile repair training institute hyderabad"]
    },
    {
        "companyName": "KA53 Mens club",
        "websiteUrl": "https://ka53mensclub.com/",
        "email": "support@ka53mensclub.com",
        "projectName": "Men's Clothing Store / E-commerce",
        "gmbName": "KA 53 Mens Club",
        "seoStrategy": "Local & organic ranking",
        "targetKeywords": ["Gym wear in Bangalore"]
    },
    {
        "companyName": "Track Pants online",
        "websiteUrl": "https://trackpants.online/",
        "email": "info@trackpants.online",
        "projectName": "Men's Clothing Store / E-commerce",
        "gmbName": "Track Pants | KR Puram | Bangalore",
        "seoStrategy": "Local & organic ranking",
        "targetKeywords": ["Track pants for men in Bangalore"]
    },
    {
        "companyName": "Terrano Info Canada Inc",
        "websiteUrl": "https://terranoinfosolutions.com/",
        "email": "info@terranoinfosolutions.com",
        "projectName": "Digital marketing company",
        "gmbName": "Terrano Info Canada Inc| Digital Marketing Company in Calgary",
        "seoStrategy": "Local & organic ranking",
        "targetKeywords": ["Local SEO Calgary", "Local SEO company Calgary"]
    },
    {
        "companyName": "BEST SAP Institute",
        "websiteUrl": "https://sapinstitutebangaluru.com/",
        "email": "ayaz@riainstitute.in",
        "projectName": "Software Training Institute",
        "gmbName": "Best SAP Institute | SAP FICO, SAP HANA, SAP SD, SAP ABAP, SAP HR Course in Marathahalli, Bangalore",
        "seoStrategy": "Local & organic ranking",
        "targetKeywords": ["SAP Training in Marathahalli", "SAP FICO training in Marathahalli", "SAP Course in Bangalore", "Best SAP Training Institute in Bangalore"]
    },
    {
        "companyName": "SERP Hawk",
        "websiteUrl": "https://serphawk.com/",
        "email": "info@serphawk.com",
        "projectName": "Digital marketing company",
        "gmbName": "SERP Hawk Bengaluru",
        "seoStrategy": "Yet to plan SEO",
        "targetKeywords": ["SEO company in btm", "seo company in bangalore"]
    },
    {
        "companyName": "Mumbai Darshan",
        "websiteUrl": "https://mumbaidarshan.pro/",
        "email": "info@mumbaidarshan.pro",
        "projectName": "Local Tour Agency",
        "gmbName": "Mumbai Darshan - Renukaa Travels",
        "seoStrategy": "Local & organic ranking",
        "targetKeywords": ["Mumbai Darshan Bus", "Mumbai Darshan Places", "Famous places in Mumbai"]
    },
    {
        "companyName": "Mumbai Darshan",
        "websiteUrl": "https://mumbaidarshan.com/",
        "email": "info@mumbaidarshan.com",
        "projectName": "Local Tour Agency",
        "gmbName": "Renukaa Mumbai Darshan Bus | Mumbai Darshan Bus Booking",
        "seoStrategy": "Local & organic ranking",
        "targetKeywords": ["Mumbai Darshan Bus", "Mumbai Darshan Bus Booking"]
    },
    {
        "companyName": "TFA- French Language School - Brampton",
        "websiteUrl": "https://frenchforpr.com/",
        "email": "torontofrenchacademy@gmail.com",
        "projectName": "Language Training Institute",
        "gmbName": "TFA - French Language School",
        "seoStrategy": "Local & organic ranking",
        "targetKeywords": ["French classes Brampton"]
    },
    {
        "companyName": "TFA- French Language School - Toronto",
        "websiteUrl": "https://frenchforpr.com/",
        "email": "torontofrenchacademy@gmail.com",
        "projectName": "Language Training Institute",
        "gmbName": "TFA - French Classes Toronto",
        "seoStrategy": "Local & organic ranking",
        "targetKeywords": ["French Classes Toronto"]
    },
    {
        "companyName": "NS POP",
        "websiteUrl": "https://nsplasterofparis.com/",
        "email": "nsplasterofparis29@gmail.com",
        "projectName": "Construction Material Supplier",
        "gmbName": "N.S Plaster of Paris | PoP False Ceiling | PoP Walls | Gypsum Board | GI Ultra Ceiling | PoP Interior & Exterior | Bangalore",
        "seoStrategy": "Local & organic ranking",
        "targetKeywords": ["false ceiling in bangalore", "false ceiling contractor in bangalore"]
    },
    {
        "companyName": "PK Law Firm",
        "websiteUrl": "https://www.pklawfirm.ca/",
        "email": "info@pklawfirm.ca",
        "projectName": "Law Firm",
        "gmbName": "PK Law & Associates Professional Corporation",
        "seoStrategy": "Local & organic ranking",
        "targetKeywords": ["Lawyers in Shelburne Ontario", "Law firm in Shelburne Ontario"]
    },
    {
        "companyName": "AIR Inv IQ",
        "websiteUrl": "https://airinviqtechnologies.com/",
        "email": "info@airinviqtechnologies.com",
        "projectName": "Software Training Institute",
        "gmbName": "Air Inv Iq Technologies - SAP Training Institute",
        "seoStrategy": "Local & organic ranking - GMB verification in progress",
        "targetKeywords": ["SAP Training in Basaveshwar nagar"]
    },
    {
        "companyName": "Python Training In Bangalore",
        "websiteUrl": "https://pythontrainingbangalore.in/",
        "email": "ayaz@riainstitute.in",
        "projectName": "Software Training Institute",
        "gmbName": "Python Training in bangalore",
        "seoStrategy": "Local & organic ranking",
        "targetKeywords": ["Python Training in Bangalore"]
    },
    {
        "companyName": "RIA DATA ANALYTICS",
        "websiteUrl": "https://riadataanalytics.com/",
        "email": "ayaz@riainstitute.in",
        "projectName": "Software Training Institute",
        "gmbName": "RIA Data Analytics | MIS | Advanced Excel | VBA | Data Analytics | Tableau Training | Marathahalli | Bangalore",
        "seoStrategy": "Local & organic ranking",
        "targetKeywords": ["Data analytics Training in Marathahalli", "Data analytics course in Bangalore"]
    },
    {
        "companyName": "Ria Classroom",
        "websiteUrl": "https://riainstitute.in/",
        "email": "ayaz@riainstitute.in",
        "projectName": "Software Training Institute",
        "gmbName": "Ria Classroom, Data Science Course Marathahalli Bangalore",
        "seoStrategy": "Local & organic ranking",
        "targetKeywords": ["Data science Training in Marathahalli", "Data science course in Bangalore"]
    },
    {
        "companyName": "SAP Class Marathahalli",
        "websiteUrl": "https://sapclassmarathahalli.online/",
        "email": "info@sapclassmarathahalli.online",
        "projectName": "Software Training Institute",
        "gmbName": "",
        "seoStrategy": "Organic ranking - GMB verification pending",
        "targetKeywords": ["SAP Training in Marathahalli"]
    },
    {
        "companyName": "S-Technologies",
        "websiteUrl": "https://s-technologies.online/",
        "email": "info@s-technologies.online",
        "projectName": "Software Training Institute",
        "gmbName": "S-Technologies SAP Fico S4 Hana Abap MM SD PP SAP BTP Training in Bangalore",
        "seoStrategy": "Local & organic ranking",
        "targetKeywords": ["SAP FICO Training in Marathahalli"]
    },
    {
        "companyName": "REAL TIME SAP",
        "websiteUrl": "http://realtimesap.com/",
        "email": "inquiry@realtimesap.com",
        "projectName": "Software Training Institute",
        "gmbName": "SCM Hub International Logistics Business School",
        "seoStrategy": "Organic ranking - GMB verification pending",
        "targetKeywords": ["SAP SD Training in Marathahalli"]
    },
    {
        "companyName": "Fashioniq Hair",
        "websiteUrl": "https://fashionic-hair.online/",
        "email": "info@fashionic-hair.online",
        "projectName": "Hair Replacement Service",
        "gmbName": "Fashionic Hair & Skin Artistry, best hair fixing in bangalore, hair patch, wigs, hair replacement and unisex salon",
        "seoStrategy": "Local & organic ranking",
        "targetKeywords": ["Hair patch service in bangalore", "hair wigs in bangalore"]
    },
    {
        "companyName": "Da Pros",
        "websiteUrl": "https://dapros.com.mx",
        "email": "contacto@dapros.com.mx",
        "projectName": "Website development company",
        "gmbName": "DaPros, Diseño web en Guadalajara",
        "seoStrategy": "Local & organic ranking",
        "targetKeywords": ["Diseño web en Guadalajara", "diseño de paginas web en guadalajara"]
    },
    {
        "companyName": "PolyFinish",
        "websiteUrl": "https://polyfinish.in/",
        "email": "Info@polyfinish.in",
        "projectName": "Flooring Contractor",
        "gmbName": "Epoxy Coating Bangalore - Polyfinish",
        "seoStrategy": "Local & organic ranking",
        "targetKeywords": ["Epoxy coating bangalore", "Epoxy floor coating bangalore"]
    },
    {
        "companyName": "CADD Center | Synergy",
        "websiteUrl": "https://cadcourse-btm.com/",
        "email": "ka.btmlayout@caddcentre.com",
        "projectName": "Software Training Institute",
        "gmbName": "",
        "seoStrategy": "GMB creation - pending",
        "targetKeywords": ["CADD course in BTM", "BIM training in BTM"]
    },
    {
        "companyName": "Mallige Hospital",
        "websiteUrl": "https://www.mallige.com/",
        "email": "info@mallige.com",
        "projectName": "Hospital",
        "gmbName": "Mallige Hospital",
        "seoStrategy": "Local & organic ranking, it is a custom website",
        "targetKeywords": ["Hospital in Seshadripuram", "best hospital in Seshadripuram"]
    },
    {
        "companyName": "Sanford Wings",
        "websiteUrl": "http://sanfordwings.com/",
        "email": "contact.sanfordwings@gmail.com",
        "projectName": "Pre School & daycare",
        "gmbName": "SANFORD WINGS International Preschool-Nursery school| Play school| kindergarten| Daycare schools in INDIRANAGAR",
        "seoStrategy": "Local & organic ranking",
        "targetKeywords": ["Play School In Indiranagar"]
    },
    {
        "companyName": "SCM HUb",
        "websiteUrl": "https://scmhub.com/",
        "email": "cochin@scmhubonline.com",
        "projectName": "College",
        "gmbName": "SCM Hub International Logistics Business School",
        "seoStrategy": "Local & organic ranking",
        "targetKeywords": ["Logistics Institute in Kochi", "logistics courses in Kochi"]
    }
]

def import_clients():
    session = Session(engine)
    
    print(f"Starting import of {len(clients_data)} clients...")
    
    for idx, client_data in enumerate(clients_data, 1):
        try:
            # Check if user exists, create if not
            email = client_data.get("email", "")
            if not email:
                email = f"noemail_{idx}@placeholder.com"
            
            user_stmt = select(User).where(User.email == email)
            user = session.exec(user_stmt).first()
            
            if not user:
                user = User(
                    email=email,
                    password="password123",
                    name=client_data["companyName"],
                    role="Client"
                )
                session.add(user)
                session.commit()
                session.refresh(user)
            
            # Create client profile
            profile = ClientProfile(
                userId=user.id,
                companyName=client_data["companyName"],
                websiteUrl=client_data["websiteUrl"],
                projectName=client_data.get("projectName", ""),
                gmbName=client_data.get("gmbName", ""),
                seoStrategy=client_data.get("seoStrategy", ""),
                targetKeywords=client_data.get("targetKeywords", []),
                status="Active"
            )
            session.add(profile)
            session.commit()
            
            print(f"DONE {idx}. {client_data['companyName']}")
            
        except Exception as e:
            print(f"ERROR {idx}. {client_data['companyName']} - Error: {e}")
            session.rollback()
    
    session.close()
    print(f"\nImport complete! Total clients imported: {len(clients_data)}")

if __name__ == "__main__":
    import_clients()
