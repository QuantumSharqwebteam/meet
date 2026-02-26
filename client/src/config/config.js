import { io } from "socket.io-client";

const SOCKET_URL =  "https://v9xdr06q-5000.inc1.devtunnels.ms";

export const socket = io(SOCKET_URL, {
  transports: ["websocket"], // force websocket only
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});