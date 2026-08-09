import sqlite3
from datetime import datetime

DB = 'd:/Nova/backend/signalcraft.db'
conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
for row in conn.execute("SELECT id, name, next_publish_at FROM agents"):
    print(row['id'], row['name'], row['next_publish_at'])
conn.close()
