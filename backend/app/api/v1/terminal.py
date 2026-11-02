import asyncio
import asyncssh
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.config import settings

router = APIRouter()

# ==== PODMIEŃ NA SWÓJ HOST TESTOWY ====
SSH_HOST = "192.168.1.0"   # IP hosta, do którego chcesz się połączyć
SSH_USER = "twoj_user"        # użytkownik SSH
# SSH_KEY = settings.SSH_KEY_PATH  # jeśli używasz klucza z .env
SSH_PASSWORD = "twoje_hasło" # jeśli używasz hasła (prostsze na test)

@router.websocket("/ws/terminal")
async def terminal_websocket(websocket: WebSocket):
    await websocket.accept()
    conn = None
    process = None
    try:
        # 1. Połącz się przez SSH
        conn = await asyncssh.connect(
            SSH_HOST,
            username=SSH_USER,
            password=SSH_PASSWORD,   # lub client_keys=[SSH_KEY]
            known_hosts=None,        # TYLKO DO TESTU — wyłącza weryfikację klucza hosta
            connect_timeout=5,
        )
        # 2. Otwórz interaktywną powłokę
        process = await conn.create_process(term_type="xterm")

        # 3. Przekazuj dane w obie strony
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
    except Exception as e:
        try:
            await websocket.send_text(f"\r\nBłąd: {e}\r\n")
        except Exception:
            pass
    finally:
        if process:
            process.close()
        if conn:
            conn.close()
        try:
            await websocket.close()
        except Exception:
            pass