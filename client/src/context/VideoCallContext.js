import React, { createContext, useState, useEffect } from "react";
import { Device } from "mediasoup-client";
import { socket } from "../config/config";

export const VideoCallContext = createContext();

export const VideoCallProvider = ({ children }) => {
  const [device, setDevice] = useState(null);
  const [sendTransport, setSendTransport] = useState(null);
  const [recvTransports, setRecvTransports] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState({}); // peerId => { stream, videoRef }

  useEffect(() => {
    const initLocalStream = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setLocalStream(stream);
    };
    initLocalStream();
  }, []);

  const joinRoom = async (roomId) => {
    socket.emit("join-room", { roomId });
    const rtpCapabilities = await new Promise(resolve => {
      socket.on("routerRtpCapabilities", resolve);
    });

    const device = new Device();
    await device.load({ routerRtpCapabilities: rtpCapabilities });
    setDevice(device);

    // create send transport
    socket.emit("createWebRtcTransport", { roomId }, async (transportOptions) => {
      const transport = device.createSendTransport(transportOptions);

      transport.on("connect", ({ dtlsParameters }, callback, errback) => {
        socket.emit("connect-transport", { dtlsParameters, roomId, transportId: transport.id }, callback);
      });

      transport.on("produce", async ({ kind, rtpParameters }, callback, errback) => {
        socket.emit("produce", { kind, rtpParameters, roomId, transportId: transport.id }, callback);
      });

      setSendTransport(transport);

      // produce tracks
      if (localStream) {
        for (const track of localStream.getTracks()) {
          await transport.produce({ track });
        }
      }
    });
  };

  return (
    <VideoCallContext.Provider value={{
      localStream,
      peers,
      joinRoom,
      sendTransport
    }}>
      {children}
    </VideoCallContext.Provider>
  );
};
