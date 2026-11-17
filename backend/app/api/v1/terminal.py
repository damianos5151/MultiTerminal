import asyncio
import ipaddress

import asyncssh
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.config import settings


def terminal_newlines(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "\r\n")


router = APIRouter()


@router.websocket("/ws/terminal")
async def terminal_websocket(websocket: WebSocket):
    await websocket.accept()
    sessions = {}
    send_lock = asyncio.Lock()

    async def send_event(event: dict):
        async with send_lock:
            await websocket.send_json(event)

    async def refresh_shell_prompt(session: dict):
        try:
            session["process"].stdin.write("\r")
            await session["process"].stdin.drain()
        except (asyncssh.Error, OSError, RuntimeError):
            pass

    async def stream_output(host: str, port: int, session: dict):
        try:
            while True:
                data = await session["process"].stdout.read(1024)
                if not data:
                    break
                await send_event({"type": "output", "host": host, "port": port, "data": data})
        except (asyncssh.Error, OSError):
            pass
        finally:
            session_key = (host, port)
            if sessions.get(session_key) is session:
                sessions.pop(session_key, None)
                session["process"].close()
                session["conn"].close()
                await send_event({"type": "status", "host": host, "port": port, "status": "disconnected"})

    async def connect_host(message: dict):
        host = message.get("host")
        port = message.get("port", 22)
        username = message.get("username")
        password = message.get("password")
        if (
            not isinstance(host, str)
            or not isinstance(username, str)
            or not isinstance(password, str)
            or not username.strip()
            or not password
        ):
            await send_event({"type": "error", "message": "Podaj adres IP, użytkownika i hasło SSH."})
            return

        if not isinstance(port, int) or isinstance(port, bool) or not 1 <= port <= 65535:
            await send_event({"type": "error", "host": host, "message": "Port SSH musi być liczbą z zakresu 1–65535."})
            return

        try:
            ipaddress.ip_address(host)
        except ValueError:
            await send_event({"type": "error", "host": host, "port": port, "message": "Podaj prawidłowy adres IPv4 lub IPv6."})
            return

        session_key = (host, port)
        if session_key in sessions:
            await send_event({"type": "error", "host": host, "port": port, "message": "Ten host ma już aktywną sesję."})
            return

        conn = None
        try:
            conn = await asyncssh.connect(
                host,
                port=port,
                username=username.strip(),
                password=password,
                known_hosts=None,
                connect_timeout=settings.SSH_TIMEOUT,
            )
            process = await conn.create_process(term_type="xterm")
            session = {
                "conn": conn,
                "process": process,
                "username": username.strip(),
                "password": password,
            }
            sessions[session_key] = session
            session["reader"] = asyncio.create_task(stream_output(host, port, session))
            await send_event({"type": "status", "host": host, "port": port, "status": "connected"})
        except (asyncssh.Error, OSError, asyncio.TimeoutError) as error:
            if conn is not None:
                conn.close()
            await send_event({"type": "status", "host": host, "port": port, "status": "error"})
            await send_event({"type": "output", "host": host, "port": port, "data": f"\r\n[{host}:{port}] Błąd połączenia SSH: {error}\r\n"})

    # Zmieniona funkcja: wysyła komendę do istniejącej sesji terminala
    async def run_command_in_session(host: str, port: int, command: str):
        session = sessions.get((host, port))
        if session is None:
            await send_event({"type": "status", "host": host, "port": port, "status": "error"})
            await send_event({"type": "output", "host": host, "port": port, "data": f"\r\n[{host}:{port}] Brak aktywnego połączenia.\r\n"})
            return

        try:
            # Wysyłamy komendę bezpośrednio do istniejącego procesu (z Enterem na końcu)
            session["process"].stdin.write(command.strip() + "\r")
            await session["process"].stdin.drain()
            
            # Status connected (błędy w komendach będą widoczne w samym terminalu)
            await send_event({"type": "status", "host": host, "port": port, "status": "connected"})
        except (asyncssh.Error, OSError) as error:
            await send_event({"type": "status", "host": host, "port": port, "status": "error"})
            await send_event({"type": "output", "host": host, "port": port, "data": f"\r\n[{host}:{port}] Błąd wykonania polecenia: {error}\r\n"})

    try:
        while True:
            try:
                message = await websocket.receive_json()
            except ValueError:
                await send_event({"type": "error", "message": "Nieprawidłowy format wiadomości."})
                continue

            if not isinstance(message, dict):
                await send_event({"type": "error", "message": "Nieprawidłowy format wiadomości."})
                continue

            action = message.get("action")
            if action == "connect":
                await connect_host(message)
            elif action == "input":
                host = message.get("host")
                port = message.get("port", 22)
                data = message.get("data")
                session = sessions.get((host, port)) if isinstance(host, str) and isinstance(port, int) else None
                if session is not None and isinstance(data, str):
                    session["process"].stdin.write(data)
                    await session["process"].stdin.drain()
            elif action == "command":
                command = message.get("command")
                target = message.get("target")
                if not isinstance(command, str) or not command.strip():
                    await send_event({"type": "error", "message": "Polecenie nie może być puste."})
                    continue

                if target == "all":
                    hosts = list(sessions)
                elif isinstance(target, dict):
                    key = (target.get("host"), target.get("port", 22))
                    hosts = [key] if key in sessions else []
                elif isinstance(target, str):
                    hosts = [key for key in sessions if key[0] == target]
                    if len(hosts) > 1:
                        await send_event({"type": "error", "message": "Podaj port, aby wskazać jednoznaczny host."})
                        continue
                else:
                    hosts = []
                if not hosts:
                    await send_event({"type": "error", "message": "Wybierz aktywny host lub wszystkie hosty."})
                    continue
                
                # Wywołujemy nową funkcję
                await asyncio.gather(*(run_command_in_session(host, port, command.strip()) for host, port in hosts))
            else:
                await send_event({"type": "error", "message": "Nieznany typ akcji WebSocket."})
    except WebSocketDisconnect:
        pass
    finally:
        readers = []
        for session in sessions.values():
            session["process"].close()
            session["conn"].close()
            reader = session.get("reader")
            if reader is not None:
                reader.cancel()
                readers.append(reader)
        if readers:
            await asyncio.gather(*readers, return_exceptions=True)
        try:
            await websocket.close()
        except (RuntimeError, WebSocketDisconnect):
            pass