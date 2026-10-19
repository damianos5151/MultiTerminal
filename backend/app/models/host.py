from datetime import datetime
from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class Host(Base):
    __tablename__ = "hosts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ip_address: Mapped[str] = mapped_column(String(45), unique=True, nullable=False, index=True)
    hostname: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="unknown", nullable=False)
    last_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    def __repr__(self):
        return f"<Host(id={self.id}, ip={self.ip_address}, status={self.status})>"