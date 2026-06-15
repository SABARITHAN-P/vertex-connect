import { io } from "socket.io-client";

const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "");
  }
  return "http://localhost:5000";
};

const SOCKET_URL = getSocketUrl();

export const socket = io(SOCKET_URL, {
  transports: ["websocket", "polling"],
  withCredentials: true
});
