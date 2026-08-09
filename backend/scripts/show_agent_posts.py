import sqlite3
AGENT_ID='e8b4e2d6-2218-4551-88dc-e94492559379'
DB='d:/Nova/backend/signalcraft.db'
conn=sqlite3.connect(DB)
conn.row_factory=sqlite3.Row
for row in conn.execute("SELECT id, created_at, published_at, status FROM posts WHERE agent_id=?", (AGENT_ID,)):
    print(row['id'], row['created_at'], row['published_at'], row['status'])
conn.close()
