import pytest
from app.models import Host

@pytest.mark.asyncio
async def test_create_host(db_session):
    host = Host(ip_address="192.168.1.10", hostname="test-host", status="online")
    db_session.add(host)
    await db_session.commit()
    await db_session.refresh(host)
    
    assert host.id is not None
    assert host.ip_address == "192.168.1.10"
    assert host.status == "online"