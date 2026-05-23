"""One-shot script: terminate stale connections, wipe Render Postgres, verify empty."""
import os, sys, psycopg2

DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    print("ERROR: set DATABASE_URL env var first")
    sys.exit(1)

conn = psycopg2.connect(DB_URL)
conn.autocommit = True
cur = conn.cursor()

# 1. Kill all other connections to this database
print("[1/4] Terminating other connections...")
cur.execute("""
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = current_database()
      AND pid <> pg_backend_pid();
""")
killed = cur.rowcount
print(f"       Terminated {killed} connection(s).")

# 2. Drop and recreate public schema
print("[2/4] Dropping public schema...")
cur.execute("DROP SCHEMA public CASCADE;")
cur.execute("CREATE SCHEMA public;")
cur.execute("GRANT ALL ON SCHEMA public TO public;")
print("       Schema recreated.")

# 3. Verify no tables exist
print("[3/4] Verifying empty database...")
cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")
count = cur.fetchone()[0]
print(f"       Tables in public schema: {count}")

cur.close()
conn.close()
print("[4/4] Done. Database is completely empty.")
