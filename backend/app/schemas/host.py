from pydantic import BaseModel, Field
from datetime import datetime

class HostBase(BaseModel):
    ip_address: str = Field(..., max_length=45, description="Adres IPv4 lub IPv6")
    hostname: str | None = Field(None, max_length=255)

class HostCreate(HostBase):
    """Schemat używany przy tworzeniu hosta (np. przez skaner)."""
    pass

class HostRead(HostBase):
    """Schemat zwracany przez API."""
    id: int
    status: str
    last_seen: datetime
    created_at: datetime

    class Config:
        from_attributes = True

class HostUpdate(BaseModel):
    """Schemat do aktualizacji (wszystkie pola opcjonalne)."""
    hostname: str | None = None
    status: str | None = None