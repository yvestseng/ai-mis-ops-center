import sqlite3
import sys

conn = sqlite3.connect(sys.argv[1])

try:
    rows = conn.execute("PRAGMA table_info(tickets)").fetchall()

    if not rows:
        raise RuntimeError("tickets table does not exist")

    print("tickets columns:")

    for row in rows:
        print(f"{row[0]:2}  {row[1]:25} {row[2]}")

finally:
    conn.close()
