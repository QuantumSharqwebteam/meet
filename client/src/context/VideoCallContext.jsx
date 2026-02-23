import React, { createContext, useState, useEffect, useCallback, useRef } from "react";
import { Device } from "mediasoup-client";
import { socket } from "../config/config";
import toast from "react-hot-toast";

export const VideoCallContext = createContext();

export const VideoCallProvider = ({ children }) => {
  const [device, setDevice] = useState(null);
  const [sendTransport, setSendTransport] = useState(null);
  const [recvTransports, setRecvTransports] = useState(new Map());
  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState(new Map());
  const [producers, setProducers] = useState(new Map());
  const [roomInfo, setRoomInfo] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [isInRoom, setIsInRoom] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Refs
  const socketListeners = useRef(new Map());
  const localStreamRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    const handleConnect = () => {
      console.log("Socket connected:", socket.id);
      setIsLoading(false);
    };

    const handleDisconnect = () => {
      console.log("Socket disconnected");
      setIsLoading(true);
    };

    const handleError = (error) => {
      console.error("Socket error:", error);
      toast.error("Connection error");
    };

    // Add listeners
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("error", handleError);

    // Cleanup
    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("error", handleError);
    };
  }, []);

  // Initialize local media stream
  const initLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }
      });
      setLocalStream(stream);
      localStreamRef.current = stream;
      return stream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      toast.error("Could not access camera/microphone");
      return null;
    }
  }, []);

  // Helper to add socket listener with cleanup tracking
  const addSocketListener = useCallback((event, handler) => {
    // Remove existing listener for this event if any
    if (socketListeners.current.has(event)) {
      socket.off(event, socketListeners.current.get(event));
    }
    
    socket.on(event, handler);
    socketListeners.current.set(event, handler);
  }, []);

  // Helper to remove all socket listeners
  const removeAllSocketListeners = useCallback(() => {
    socketListeners.current.forEach((handler, event) => {
      socket.off(event, handler);
    });
    socketListeners.current.clear();
  }, []);

  // Setup room socket handlers
  const setupRoomSocketHandlers = useCallback(() => {
    // Clear previous listeners first
    removeAllSocketListeners();

    // Handle router capabilities
    addSocketListener("router-rtp-capabilities", async (data) => {
      try {
        console.log("Received router capabilities:", data);
        const { routerRtpCapabilities, roomId, peerId } = data;
        
        const newDevice = new Device();
        await newDevice.load({ routerRtpCapabilities });
        setDevice(newDevice);
        
        // Send our RTP capabilities back to server
        socket.emit("update-rtp-capabilities", {
          rtpCapabilities: newDevice.rtpCapabilities
        }, (response) => {
          if (response.success) {
            console.log("RTP capabilities updated on server");
            setIsInRoom(true);
            toast.success("Connected to room!");
          }
        });
        
      } catch (error) {
        console.error("Failed to load device:", error);
        toast.error("Failed to initialize media device");
      }
    });

    // Handle peer joined
    addSocketListener("peer-joined", ({ peerId, displayName }) => {
      if (peerId === socket.id) return;

      setPeers(prev => {
        const newPeers = new Map(prev);
        if (!newPeers.has(peerId)) {
          newPeers.set(peerId, {
            id: peerId,
            displayName,
            videoRef: React.createRef(),
            audioRef: React.createRef(),
            streams: new Map(),
            isSpeaking: false
          });
        }
        return newPeers;
      });
      toast(`${displayName} joined`);
    });

    // Handle peer left
    addSocketListener("peer-left", ({ peerId, displayName }) => {
      setPeers(prev => {
        const newPeers = new Map(prev);
        if (newPeers.has(peerId)) {
          newPeers.delete(peerId);
          toast(`${displayName || 'A participant'} left`);
        }
        return newPeers;
      });
    });

    // Handle new producer
    addSocketListener("new-producer", ({ producerId, peerId, kind, appData }) => {
      console.log("New producer:", { producerId, peerId, kind });
      // You'll need to implement consumeProducer function here
    });

    // Handle connection errors
    addSocketListener("connect_error", (error) => {
      console.error("Connection error:", error);
      toast.error("Failed to connect to server");
    });
  }, [addSocketListener, removeAllSocketListeners]);

  // Join room function
  const joinRoom = useCallback(async (roomId, displayName) => {
    try {
      setIsLoading(true);
      toast.loading("Joining room...");
      
      // Initialize local stream if not already done
      if (!localStreamRef.current) {
        await initLocalStream();
      }
      
      // Setup socket handlers
      setupRoomSocketHandlers();
      
      // Emit join room event
      socket.emit("join-room", { 
        roomId, 
        displayName: displayName || `User_${Math.random().toString(36).substr(2, 4)}`
      }, (response) => {
        toast.dismiss();
        
        if (response.success) {
          setCurrentRoomId(roomId);
          setRoomInfo(response.roomInfo);
          console.log("Join room response:", response);
          setIsLoading(false);
          // Don't set isInRoom here, wait for router-rtp-capabilities
        } else {
          toast.error(response.error || "Failed to join room");
          setIsLoading(false);
        }
      });
      
    } catch (error) {
      console.error("Error joining room:", error);
      toast.error("Failed to join room");
      setIsLoading(false);
    }
  }, [initLocalStream, setupRoomSocketHandlers]);

  // Create send transport and produce tracks
  const initializeMedia = useCallback(async () => {
    if (!device || !isInRoom || !localStreamRef.current) return;

    try {
      // Create send transport
      socket.emit("create-transport", { direction: 'send' }, async (response) => {
        if (response.success) {
          const transport = device.createSendTransport(response.params);

          transport.on("connect", async ({ dtlsParameters }, callback, errback) => {
            socket.emit("connect-transport", {
              transportId: transport.id,
              dtlsParameters
            }, (result) => {
              if (result.success) {
                callback();
              } else {
                errback(new Error(result.error || "Transport connect failed"));
              }
            });
          });

          transport.on("produce", async ({ kind, rtpParameters, appData }, callback, errback) => {
            socket.emit("produce", {
              kind,
              rtpParameters,
              transportId: transport.id,
              appData
            }, (result) => {
              if (result.success) {
                callback({ id: result.id });
              } else {
                errback(new Error(result.error || "Produce failed"));
              }
            });
          });

          setSendTransport(transport);

          // Produce local tracks
          const stream = localStreamRef.current;
          const audioTrack = stream.getAudioTracks()[0];
          const videoTrack = stream.getVideoTracks()[0];

          if (audioTrack) {
            try {
              const audioProducer = await transport.produce({
                track: audioTrack,
                appData: { source: 'mic' }
              });
              setProducers(prev => new Map(prev).set('audio', audioProducer));
            } catch (error) {
              console.error("Failed to produce audio:", error);
            }
          }

          if (videoTrack) {
            try {
              const videoProducer = await transport.produce({
                track: videoTrack,
                appData: { source: 'camera' }
              });
              setProducers(prev => new Map(prev).set('video', videoProducer));
            } catch (error) {
              console.error("Failed to produce video:", error);
            }
          }
        }
      });
    } catch (error) {
      console.error("Initialize media failed:", error);
    }
  }, [device, isInRoom]);

  // Initialize media when device is ready and in room
  useEffect(() => {
    if (device && isInRoom) {
      initializeMedia();
    }
  }, [device, isInRoom, initializeMedia]);

  // Toggle audio mute
  const toggleAudio = useCallback(async () => {
    if (!localStreamRef.current || !isInRoom) {
      toast.error("Not connected to room");
      return;
    }
    
    try {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
        
        // Update producer if it exists
        const audioProducer = producers.get('audio');
        if (audioProducer) {
          if (audioTrack.enabled) {
            await audioProducer.resume();
          } else {
            await audioProducer.pause();
          }
        }
        
        toast(audioTrack.enabled ? "Microphone on" : "Microphone muted");
      }
    } catch (error) {
      console.error("Toggle audio error:", error);
      toast.error("Failed to toggle audio");
    }
  }, [producers, isInRoom]);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (!localStreamRef.current || !isInRoom) {
      toast.error("Not connected to room");
      return;
    }
    
    try {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
        
        // Update producer if it exists
        const videoProducer = producers.get('video');
        if (videoProducer) {
          if (videoTrack.enabled) {
            await videoProducer.resume();
          } else {
            await videoProducer.pause();
          }
        }
        
        toast(videoTrack.enabled ? "Camera on" : "Camera off");
      }
    } catch (error) {
      console.error("Toggle video error:", error);
      toast.error("Failed to toggle video");
    }
  }, [producers, isInRoom]);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    if (!isInRoom) {
      toast.error("Not connected to room");
      return;
    }
    
    try {
      if (isScreenSharing) {
        // Stop screen sharing
        if (screenStream) {
          screenStream.getTracks().forEach(track => track.stop());
          setScreenStream(null);
        }
        setIsScreenSharing(false);
        toast("Stopped screen sharing");
      } else {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false
        });
        
        setScreenStream(stream);
        setIsScreenSharing(true);
        toast("Started screen sharing");
      }
    } catch (error) {
      console.error("Screen share error:", error);
      toast.error("Failed to toggle screen share");
    }
  }, [isScreenSharing, screenStream, isInRoom]);

  // Start/stop recording
  const toggleRecording = useCallback(async () => {
    if (!isInRoom) {
      toast.error("Not connected to room");
      return;
    }
    
    if (isRecording) {
      // Stop recording
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
      setIsRecording(false);
      toast("Recording stopped");
    } else {
      try {
        const stream = localStreamRef.current;
        if (!stream) {
          toast.error("No media stream available");
          return;
        }
        
        const recorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9,opus'
        });
        
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            setRecordedChunks(prev => [...prev, event.data]);
          }
        };
        
        recorder.onstop = () => {
          if (recordedChunks.length > 0) {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `meeting-${Date.now()}.webm`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success("Recording saved");
          }
          setRecordedChunks([]);
        };
        
        recorder.start();
        setMediaRecorder(recorder);
        setIsRecording(true);
        toast("Recording started");
      } catch (error) {
        console.error("Recording error:", error);
        toast.error("Failed to start recording");
      }
    }
  }, [isRecording, mediaRecorder, recordedChunks, isInRoom]);

  // Leave room
  const leaveRoom = useCallback(() => {
    if (!isInRoom || !currentRoomId) return;

    socket.emit("leave-room", {}, (response) => {
      if (response.success) {
        // Cleanup
        removeAllSocketListeners();
        setPeers(new Map());
        setProducers(new Map());
        setSendTransport(null);
        setRecvTransports(new Map());
        setRoomInfo(null);
        setIsInRoom(false);
        setCurrentRoomId(null);
        setIsAudioMuted(false);
        setIsVideoOff(false);
        setIsScreenSharing(false);
        
        toast("Left the meeting");
      }
    });
  }, [isInRoom, currentRoomId, removeAllSocketListeners]);

  // Initialize on mount
  useEffect(() => {
    initLocalStream();
    
    return () => {
      // Cleanup on unmount
      if (isInRoom) {
        leaveRoom();
      }
      removeAllSocketListeners();
    };
  }, [initLocalStream, isInRoom, leaveRoom, removeAllSocketListeners]);

  return (
    <VideoCallContext.Provider value={{
      device,
      localStream,
      peers,
      roomInfo,
      isAudioMuted,
      isVideoOff,
      isRecording,
      isScreenSharing,
      isInRoom,
      isLoading,
      joinRoom,
      toggleAudio,
      toggleVideo,
      toggleScreenShare,
      toggleRecording,
      leaveRoom
    }}>
      {children}
    </VideoCallContext.Provider>
  );
};