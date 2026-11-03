import asyncio
import ipaddress

import asyncssh
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.config import settings

router = APIRouter()


@router.websocket("/ws/terminal")
async def terminal_websocket(websocket: WebSocket):
    await websocket.accept()
    conn = None
    process = None
    try:
        try:
            credentials = await websocket.receive_json()
        except ValueError:
            await websocket.send_text("Błędny format danych logowania.\r\n")
            await websocket.close(code=1008)
            return

        if not isinstance(credentials, dict):
            await websocket.send_text("Błędny format danych logowania.\r\n")
            await websocket.close(code=1008)
            return

        host = credentials.get("host")
        username = credentials.get("username")
        password = credentials.get("password")
        if (
            not isinstance(host, str)
            or not isinstance(username, str)
            or not isinstance(password, str)
            or not host
            or not username.strip()
            or not password
        ):
            await websocket.send_text("Podaj adres IP, użytkownika i hasło SSH.\r\n")
            await websocket.close(code=1008)
            return

        try:
            ipaddress.ip_address(host)
        except ValueError:
            await websocket.send_text("Podaj prawidłowy adres IPv4 lub IPv6.\r\n")
            await websocket.close(code=1008)
            return

        conn = await asyncssh.connect(
            host,
            username=username.strip(),
            password=password,
            known_hosts=None,
            connect_timeout=settings.SSH_TIMEOUT,
        )
        process = await conn.create_process(term_type="xterm")

        async def ws_to_ssh():
            while True:
                data = await websocket.receive_text()
                process.stdin.write(data)

        async def ssh_to_ws():
            while True:
                data = await process.stdout.read(1024)
                if not data:
                    break
                await websocket.send_text(data)

        await asyncio.gather(ws_to_ssh(), ssh_to_ws())

    except WebSocketDisconnect:
        pass
    except (asyncssh.Error, OSError, asyncio.TimeoutError) as error:
        try:
            await websocket.send_text(f"\r\nBłąd połączenia SSH: {error}\r\n")
        except WebSocketDisconnect:
            pass
    finally:
        if process:
            process.close()
        if conn:
            conn.close()
        try:
            await websocket.close()
        except (RuntimeError, WebSocketDisconnect):
            pass
