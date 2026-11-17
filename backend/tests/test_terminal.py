import asyncio

from fastapi.testclient import TestClient

from app.api.v1 import terminal
from app.main import app


class FakeStdin:
    def __init__(self):
        self.writes = []

    def write(self, data: str):
        self.writes.append(data)

    async def drain(self):
        pass


class FakeStdout:
    async def read(self, _size: int):
        await asyncio.Event().wait()


class FakeProcess:
    def __init__(self):
        self.stdin = FakeStdin()
        self.stdout = FakeStdout()

    def close(self):
        pass


class FakeConnection:
    def __init__(self, process: FakeProcess):
        self.process = process

    async def create_process(self, **_kwargs):
        return self.process

    def close(self):
        pass


def test_command_sends_terminal_enter(monkeypatch):
    process = FakeProcess()
    connection = FakeConnection(process)

    async def fake_connect(*_args, **_kwargs):
        return connection

    monkeypatch.setattr(terminal.asyncssh, "connect", fake_connect)

    with TestClient(app) as client:
        with client.websocket_connect("/ws/terminal") as websocket:
            websocket.send_json({
                "action": "connect",
                "host": "192.0.2.1",
                "port": 22,
                "username": "test",
                "password": "test",
            })
            assert websocket.receive_json()["status"] == "connected"

            websocket.send_json({
                "action": "command",
                "target": "all",
                "command": "whoami",
            })
            assert websocket.receive_json()["status"] == "connected"

    assert process.stdin.writes == ["whoami\r"]
