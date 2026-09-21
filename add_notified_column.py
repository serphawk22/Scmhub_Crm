import sqlite3

def add_is_notified_column():
    conn = sqlite3.connect("database.db")
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE cases ADD COLUMN is_notified BOOLEAN DEFAULT 0")
        conn.commit()
        print("Successfully added is_notified to cases table.")
    except sqlite3.OperationalError as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    add_is_notified_column()
