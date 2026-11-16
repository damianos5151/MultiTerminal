import logging

from fastapi import APIRouter, BackgroundTasks, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.core.config import settings
from app.models import Host
from app.models.session import get_db
from app.services.scanner_service import scan_network

router = APIRouter(tags=["scan"])
logger = logging.getLogger(__name__)


async def _scan_and_store_hosts(ip_range: str) -> None:
    try:
        ip_addresses = await scan_network(ip_range)
        logger.info(
            "Network scan found %d host(s): %s",
            len(ip_addresses),
            ", ".join(ip_addresses) if ip_addresses else "none",
        )
        if not ip_addresses:
            return

        db_dependency = get_db()
        db = await anext(db_dependency)
        try:
            existing_result = await db.scalars(
                select(Host.ip_address).where(Host.ip_address.in_(ip_addresses))
            )
            existing_ips = set(existing_result.all())
            new_ips = set(ip_addresses) - existing_ips

            if new_ips:
                statement = (
                    insert(Host)
                    .values(
                        [
                            {
                                "ip_address": ip_address,
                                "status": "unknown",
                                "hostname": None,
                            }
                            for ip_address in new_ips
                        ]
                    )
                    .on_conflict_do_nothing(index_elements=[Host.ip_address])
                )
                await db.execute(statement)

            await db.commit()
        finally:
            await db_dependency.aclose()
    except Exception:
        logger.exception("Network scan or host persistence failed")
        raise


@router.post("/scan", status_code=status.HTTP_202_ACCEPTED)
async def start_network_scan(background_tasks: BackgroundTasks) -> dict[str, str]:
    background_tasks.add_task(_scan_and_store_hosts, settings.SCAN_SUBNET)
    return {"message": "Network scan started"}
