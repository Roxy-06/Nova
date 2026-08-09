from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import get_settings

settings = get_settings()
database_url = getattr(settings, "database_url", "sqlite:///./signalcraft.db")
# Cloud Postgres providers (e.g. Render, Supabase, Neon) often export
# DATABASE_URL starting with postgres://. SQLAlchemy 1.4+ and 2.0 require postgresql://.
if database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

is_sqlite = database_url.startswith("sqlite")

# SQLite needs concurrency pragmas/timeout; Postgres needs connection recycling and health pinging.
engine_kwargs = {}
if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False, "timeout": 30}
else:
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 300

engine = create_engine(database_url, **engine_kwargs)

if is_sqlite:
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, _connection_record) -> None:
        # WAL lets readers (e.g. GET /feed, /telemetry) proceed without
        # waiting on the background scanner's writes, and busy_timeout backs
        # up the connect_args timeout at the SQLite level itself.
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()