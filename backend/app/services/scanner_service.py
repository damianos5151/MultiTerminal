import asyncio
import ipaddress

TCP_PORT = 22
CONNECTION_TIMEOUT_SECONDS = 0.75
MAX_CONCURRENT_CHECKS = 128
MAX_NETWORK_ADDRESSES = 256


async def scan_network(ip_range: str) -> list[str]:
    """Return private IPv4 addresses that accept TCP connections on port 22."""
    network = ipaddress.ip_network(ip_range, strict=False)
    if not isinstance(network, ipaddress.IPv4Network) or not network.is_private:
        raise ValueError("Network scanning is limited to private IPv4 ranges.")
    if network.num_addresses > MAX_NETWORK_ADDRESSES:
        raise ValueError(
            f"Network is too large to scan at once (maximum {MAX_NETWORK_ADDRESSES} addresses)."
        )

    semaphore = asyncio.Semaphore(MAX_CONCURRENT_CHECKS)

    async def check_ssh(ip_address: ipaddress.IPv4Address) -> str | None:
        async with semaphore:
            writer: asyncio.StreamWriter | None = None
            try:
                _, writer = await asyncio.wait_for(
                    asyncio.open_connection(str(ip_address), TCP_PORT),
                    timeout=CONNECTION_TIMEOUT_SECONDS,
                )
                return str(ip_address)
            except (OSError, asyncio.TimeoutError):
                return None
            finally:
                if writer is not None:
                    writer.close()
                    await writer.wait_closed()

    results = await asyncio.gather(*(check_ssh(ip) for ip in network.hosts()))
    return [ip_address for ip_address in results if ip_address is not None]
