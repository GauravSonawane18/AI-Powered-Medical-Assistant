from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError

from app.utils.security import decode_access_token
from app.websocket.manager import manager

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)) -> None:
    try:
        payload = decode_access_token(token)
        user_id = int(payload.get("sub", "0"))
        if user_id == 0:
            raise ValueError("invalid sub")
    except (JWTError, ValueError):
        await websocket.close(code=4001)
        return

    await manager.connect(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()  # accepts ping / keep-alive frames
    except WebSocketDisconnect:
        manager.disconnect(user_id)
