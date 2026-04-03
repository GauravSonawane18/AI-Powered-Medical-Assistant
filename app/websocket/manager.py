import logging

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[int, WebSocket] = {}

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[user_id] = websocket
        logger.info("WS connected user=%d  total=%d", user_id, len(self._connections))

    def disconnect(self, user_id: int) -> None:
        self._connections.pop(user_id, None)
        logger.info("WS disconnected user=%d  total=%d", user_id, len(self._connections))

    async def send_to(self, user_id: int, payload: dict) -> bool:
        ws = self._connections.get(user_id)
        if ws is None:
            return False
        try:
            await ws.send_json(payload)
            return True
        except Exception:
            self.disconnect(user_id)
            return False


manager = ConnectionManager()
