from dotenv import load_dotenv
load_dotenv()
from database import engine
from sqlmodel import text

def add_lead_columns():
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE radar_analyses ADD COLUMN lead_id INTEGER REFERENCES leads(id);"))
            print("Added lead_id to radar_analyses")
        except Exception as e:
            print("lead_id in radar_analyses err:", e)
        
        try:
            conn.execute(text("ALTER TABLE competitor_relationships ADD COLUMN source_lead_id INTEGER REFERENCES leads(id);"))
            print("Added source_lead_id to competitor_relationships")
        except Exception as e:
            print("source_lead_id err:", e)

        try:
            conn.execute(text("ALTER TABLE competitor_relationships ADD COLUMN discovered_lead_id INTEGER REFERENCES leads(id);"))
            print("Added discovered_lead_id to competitor_relationships")
        except Exception as e:
            print("discovered_lead_id err:", e)
            
        try:
            conn.execute(text("ALTER TABLE competitor_relationships ALTER COLUMN source_client_id DROP NOT NULL;"))
            print("Made source_client_id nullable in competitor_relationships")
        except Exception as e:
            print("source_client_id nullable err:", e)

if __name__ == "__main__":
    add_lead_columns()
