from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.session import get_db
from app.models import Host
from app.schemas.host import HostRead

router = APIRouter(prefix="/hosts", tags=["hosts"])

@router.get("", response_model=list[HostRead])
async def list_hosts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Host))
    return result.scalars().all()