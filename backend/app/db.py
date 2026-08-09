from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import get_settings

settings = get_settings()
database_url = getattr(settings, "database_url", "sqlite:///./signalcraft.db")
is_sqlite = database_url.startswith("sqlite")
# `timeout` here is SQLite's busy-wait: how long a connection will patiently
# wait for a lock held by another connection before raising "database is
# locked", instead of failing after the driver default of 5s. With the
# editorial loop now running continuously in the background, some overlap
# with API requests (e.g. POST /api/agent/init) is expected and should wait,
# not error. For Postgres we don't use these sqlite-only options.
connect_args = {"check_same_thread": False, "timeout": 30} if is_sqlite else {}
engine = create_engine(database_url, connect_args=connect_args)

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