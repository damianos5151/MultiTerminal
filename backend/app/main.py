from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.session import get_db
from app.schemas.host import HostRead
from app.models import Host
from sqlalchemy import select

app = FastAPI()

@app.get("/api/v1/hosts", response_model=list[HostRead])
async def list_hosts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Host))
    return result.scalars().all()