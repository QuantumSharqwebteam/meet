import { io } from "socket.io-client";

const URL = "https://gblfs69p-5000.inc1.devtunnels.ms/";
// const URL = "https://video-call-server-gm7i.onrender.com";

export const socket = io(URL);
export const navbarBrand = "YourVideoShare";
