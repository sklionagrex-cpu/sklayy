import asyncio
import websockets

async def echo(websocket, path):
    async for message in websocket:
        print(f"Получено: {message}")
        await websocket.send(f"Эхо: {message}")

async def main():
    async with websockets.serve(echo, "0.0.0.0", 8765):
        print("Сервер запущен на ws://0.0.0.0:8765")
        await asyncio.Future()  # работаем вечно

if __name__ == "__main__":
    asyncio.run(main())
