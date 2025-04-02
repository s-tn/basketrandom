import prisma from "@/lib/prisma";

export function GET() {
    const headers = new Headers();
    headers.set('Connection', 'Upgrade');
    headers.set('Upgrade', 'websocket');
    return new Response('Upgrade Required', { status: 426, headers });
}

const sockets: import("ws").WebSocket[] = [];

setInterval(async () => {
  const rooms = await prisma.room.findMany();
  for (const room of rooms) {
    // Notify each room's sockets about the current number of connections
    const roomSockets = sockets.filter((socket: any) => socket.id === room.id && socket.readyState === 1); // Filter for open sockets in this room
    if (roomSockets.length === 0) {
      await prisma.room.delete({
        where: {
          id: room.id,
        },
      });

      console.log(`No active sockets in room ${room.id}, deleting room.`);
    }
  }
}, 10000);

export async function SOCKET(
    client: import("ws").WebSocket,
    request: import("http").IncomingMessage,
    server: import("ws").WebSocketServer
  ) {
    const id = request.url?.match(/^\/api\/lobby\/(.*)/)?.[1];

    if (!id) {
      return client.close();
    }

    const room = await prisma.room.findFirst({
      where: {
        id
      }
    });

    if (!room) {
      return client.close();
    }

    (client as any).id = id;

    sockets.push(client); // Store the client in the sockets array

    sockets.forEach((socket) => {
      socket.send(JSON.stringify({
        type: "conn",
        roomId: id,
        sockets: sockets.filter((s: any) => s.id === id).length,
      }));
    });

    client.on("message", (message) => {
      if (message.toString() === "ping") {
        client.send("pong");
      } else {
        const data = JSON.parse(message.toString());
        if (data.type === 'start-game') {
          sockets.forEach((socket) => {
            const gameSocket = `/api/headless/${data.roomId}`;
            socket.send(JSON.stringify({
              type: "start-game",
              roomId: data.roomId,
              gameSocket,
            }));
          });
        }
      }
    });
  
    client.on("close", () => {
      console.log("A client disconnected");
      sockets.splice(sockets.indexOf(client), 1); // Remove the client from the sockets array
      sockets.forEach((socket) => {
        socket.send(JSON.stringify({
          type: "conn",
          sockets: sockets.filter((s: any) => s.id === id).length,
        }));
      });
    });
  }