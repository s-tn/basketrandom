export function GET() {
    const headers = new Headers();
    headers.set('Connection', 'Upgrade');
    headers.set('Upgrade', 'websocket');
    return new Response('Upgrade Required', { status: 426, headers });
  }

const sockets = [];

export function SOCKET(
    client: import("ws").WebSocket,
    request: import("http").IncomingMessage,
    server: import("ws").WebSocketServer
  ) {
    console.log("A client connected");

    sockets.push(client); // Store the client in the sockets array

    console.log(sockets.length);
  
    client.on("message", (message) => {
      console.log("Received message:", message);
      client.send(message);
    });
  
    client.on("close", () => {
      console.log("A client disconnected");
    });
  }