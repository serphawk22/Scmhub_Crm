import sys
from sqlmodel import Session, text
from database import engine

def main():
    try:
        with Session(engine) as session:
            session.exec(text("TRUNCATE TABLE clientprofile RESTART IDENTITY CASCADE;"))
            session.commit()
            print("Successfully truncated clientprofile and reset ID counter.")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
