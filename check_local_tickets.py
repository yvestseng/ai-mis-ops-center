import sqlite3
import sys

connection = sqlite3.connect(sys.argv[1])

try:
    rows = connection.execute("""
        SELECT ticket_number, title, status, priority
        FROM tickets
        ORDER BY created_at DESC
    """).fetchall()

    print(f"本機工單數量：{len(rows)}")

    for row in rows:
        print(row)
finally:
    connection.close()
