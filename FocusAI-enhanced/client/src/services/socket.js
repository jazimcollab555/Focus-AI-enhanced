import { io } from "socket.io-client";

// In production, this would be an env var
const URL = "http://localhost:3000";

export const socket = io(URL, {
    autoConnect: false
});
