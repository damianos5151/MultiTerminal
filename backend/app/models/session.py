from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from app.core.config import settings
from collections.abc import AsyncGenerator

# Async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,           # True = logi SQL
    pool_size=10,         # liczba połączeń w puli
    max_overflow=20,      # dodatkowe połączenia po przekroczeniu pool_size
    pool_pre_ping=True,   # sprawdza, czy połączenie żyje przed użyciem
)

# Fabryka sesji async
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,  # ważne przy async
    autoflush=False,
)

# Dependency dla FastAPI
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Zwraca async sesję bazy i zamyka ją po użyciu."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()