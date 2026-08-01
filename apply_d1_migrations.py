import sqlite3
import sys
from pathlib import Path

db_path = Path(sys.argv[1]).resolve()
migration_dir = Path(sys.argv[2]).resolve()

sql_files = sorted(migration_dir.glob("*.sql"))

if not db_path.exists():
    raise FileNotFoundError(f"Database not found: {db_path}")

if not sql_files:
    raise FileNotFoundError(f"No SQL files found: {migration_dir}")

print(f"Database: {db_path}")

conn = sqlite3.connect(str(db_path))

try:
    conn.execute("PRAGMA foreign_keys = OFF;")

    for sql_file in sql_files:
        print(f"\nApplying {sql_file.name}")

        sql = sql_file.read_text(encoding="utf-8")
        statements = sql.replace("--> statement-breakpoint", ";").split(";")

        for statement in statements:
            statement = statement.strip()

            if not statement:
                continue

            try:
                conn.execute(statement)
            except sqlite3.OperationalError as error:
                message = str(error).lower()

                if (
                    "already exists" in message
                    or "duplicate column name" in message
                ):
                    print(f"Skipped: {error}")
                    continue

                raise
            except sqlite3.IntegrityError as error:
                message = str(error).lower()

                if (
                    "unique constraint failed" in message
                    or "foreign key constraint failed" in message
                ):
                    print(f"Skipped seed data: {error}")
                    continue

                raise

        conn.commit()
        print(f"Completed {sql_file.name}")

    conn.execute("PRAGMA foreign_keys = ON;")

    tables = conn.execute("""
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
        ORDER BY name
    """).fetchall()

    print("\nDatabase tables:")

    for row in tables:
        print(f" - {row[0]}")

    tickets_exists = conn.execute("""
        SELECT COUNT(*)
        FROM sqlite_master
        WHERE type = 'table'
          AND name = 'tickets'
    """).fetchone()[0]

    if tickets_exists != 1:
        raise RuntimeError("tickets table was not created")

    print("\nSUCCESS: tickets table exists.")

finally:
    conn.close()
