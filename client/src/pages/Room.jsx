import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';
import toast, { Toaster } from 'react-hot-toast';
import VideoTile from '../components/VideoTile';
import ControlBar from '../components/ControlBar';
import ChatPanel from '../components/ChatPanel';
import ParticipantsPanel from '../components/ParticipantsPanel';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://v9xdr06q-5000.inc1.devtunnels.ms';

const Room = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const displayName = searchParams.get('name') || 'Anonymous';

  // State
  const [device, setDevice] = useState(null);
  const [streams, setStreams] = useState({});
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [audioLevels, setAudioLevels] = useState({});
  const [isJoined, setIsJoined] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');

  // Refs
  const socketRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const localStreamRef = useRef(null);
  const consumersRef = useRef({});
  const producersRef = useRef({});

  // Initialize socket connection
  useEffect(() => {
    console.log('Initializing socket connection...');
    setConnectionStatus('Connecting to server...');
    
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current.on('connect', () => {
      console.log('Connected to server');
      setConnectionStatus('Connected, joining room...');
      joinRoom();
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnectionStatus('Connection failed');
      toast.error('Failed to connect to server');
    });

    socketRef.current.on('router-rtp-capabilities', handleRouterCapabilities);
    socketRef.current.on('new-producer', handleNewProducer);
    socketRef.current.on('peer-joined', handlePeerJoined);
    socketRef.current.on('peer-left', handlePeerLeft);
    socketRef.current.on('peer-audio-toggled', handlePeerAudioToggled);
    socketRef.current.on('peer-video-toggled', handlePeerVideoToggled);
    socketRef.current.on('peer-hand-raised', handlePeerHandRaised);
    socketRef.current.on('new-message', handleNewMessage);
    socketRef.current.on('peer-name-changed', handlePeerNameChanged);

    return () => {
      console.log('Cleaning up...');
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    Object.values(consumersRef.current).forEach(consumer => {
      try {
        consumer.close();
      } catch (error) {
        console.error('Error closing consumer:', error);
      }
    });
    
    if (sendTransportRef.current) {
      try {
        sendTransportRef.current.close();
      } catch (error) {
        console.error('Error closing send transport:', error);
      }
    }
    
    if (recvTransportRef.current) {
      try {
        recvTransportRef.current.close();
      } catch (error) {
        console.error('Error closing recv transport:', error);
      }
    }
    
    socketRef.current?.disconnect();
  };

  const joinRoom = useCallback(() => {
    console.log('Emitting join-room with:', { roomId, displayName });
    
    socketRef.current.emit('join-room', {
      roomId,
      displayName
    }, (response) => {
      console.log('Join room response:', response);
      
      if (response.success) {
        console.log('Existing producers:', response.existingProducers);
        
        // Store existing producers to consume later
        if (response.existingProducers && response.existingProducers.length > 0) {
          console.log(`Will need to consume ${response.existingProducers.length} producers`);
          // We'll consume these after device and transports are ready
          window.existingProducersToConsume = response.existingProducers;
        }
        
        // Add existing participants
        const uniquePeers = new Map();
        response.existingProducers.forEach(producer => {
          if (!uniquePeers.has(producer.peerId)) {
            uniquePeers.set(producer.peerId, {
              id: producer.peerId,
              displayName: producer.displayName,
              isLocal: false,
              isAudioMuted: false,
              isVideoMuted: false,
              isHandRaised: false
            });
          }
        });
        
        const newParticipants = Array.from(uniquePeers.values());
        console.log('Adding participants:', newParticipants);
        setParticipants(newParticipants);
        
        setIsJoined(true);
        setConnectionStatus('Joined room');
        toast.success(`Joined room: ${roomId}`);
      } else {
        console.error('Failed to join room:', response.error);
        toast.error(response.error || 'Failed to join room');
        navigate('/');
      }
    });
  }, [roomId, displayName, navigate]);

  const handleRouterCapabilities = useCallback(async (data) => {
    console.log('Received router capabilities:', data);
    setConnectionStatus('Setting up media...');
    
    try {
      // Create device
      console.log('Creating mediasoup device...');
      const mediasoupDevice = new mediasoupClient.Device();
      await mediasoupDevice.load({ routerRtpCapabilities: data.routerRtpCapabilities });
      console.log('Mediasoup device loaded successfully');
      setDevice(mediasoupDevice);

      // Send RTP capabilities to server
      socketRef.current.emit('update-rtp-capabilities', {
        rtpCapabilities: mediasoupDevice.rtpCapabilities
      });

      // Create transports
      await createTransports(mediasoupDevice);
      
      // Get user media
      await getUserMediaAndProduce(mediasoupDevice);
      
    } catch (error) {
      console.error('Failed to initialize device:', error);
      setConnectionStatus('Failed to setup media');
      toast.error('Failed to initialize media device');
    }
  }, []);

  const createTransports = async (mediasoupDevice) => {
    console.log('Creating transports...');
    
    return new Promise((resolve, reject) => {
      let transportsCreated = 0;

      // Create send transport
      socketRef.current.emit('create-transport', { direction: 'send' }, (response) => {
        if (response.success) {
          console.log('Send transport created:', response.params);
          sendTransportRef.current = mediasoupDevice.createSendTransport(response.params);
          
          sendTransportRef.current.on('connect', ({ dtlsParameters }, callback, errback) => {
            console.log('Send transport connect');
            socketRef.current.emit('connect-transport', {
              transportId: sendTransportRef.current.id,
              dtlsParameters
            }, (response) => {
              if (response.success) {
                callback();
              } else {
                errback(new Error('Failed to connect transport'));
              }
            });
          });

          sendTransportRef.current.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
            console.log('Send transport produce:', kind);
            socketRef.current.emit('produce', {
              transportId: sendTransportRef.current.id,
              kind,
              rtpParameters,
              appData
            }, (response) => {
              if (response.success) {
                console.log('Producer created with id:', response.id);
                callback({ id: response.id });
              } else {
                errback(new Error('Failed to produce'));
              }
            });
          });

          transportsCreated++;
          if (transportsCreated === 2) {
            console.log('Both transports created');
            resolve();
          }
        } else {
          reject(new Error('Failed to create send transport'));
        }
      });

      // Create receive transport
      socketRef.current.emit('create-transport', { direction: 'recv' }, (response) => {
        if (response.success) {
          console.log('Receive transport created:', response.params);
          recvTransportRef.current = mediasoupDevice.createRecvTransport(response.params);
          
          recvTransportRef.current.on('connect', ({ dtlsParameters }, callback, errback) => {
            console.log('Receive transport connect');
            socketRef.current.emit('connect-transport', {
              transportId: recvTransportRef.current.id,
              dtlsParameters
            }, (response) => {
              if (response.success) {
                callback();
              } else {
                errback(new Error('Failed to connect transport'));
              }
            });
          });

          transportsCreated++;
          if (transportsCreated === 2) {
            console.log('Both transports created');
            
            // Now that transports are ready, consume existing producers
            if (window.existingProducersToConsume && window.existingProducersToConsume.length > 0) {
              console.log('Consuming existing producers:', window.existingProducersToConsume);
              setTimeout(() => {
                consumeProducers(window.existingProducersToConsume);
              }, 1000);
            }
            
            resolve();
          }
        } else {
          reject(new Error('Failed to create receive transport'));
        }
      });
    });
  };

  const getUserMediaAndProduce = async (mediasoupDevice) => {
    try {
      console.log('Requesting user media...');
      setConnectionStatus('Requesting camera/microphone...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        }
      });
      
      console.log('Got user media, tracks:', stream.getTracks().length);
      localStreamRef.current = stream;
      
      // Add local stream to state
      setStreams(prev => ({
        ...prev,
        local: stream
      }));

      // Produce audio
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack && sendTransportRef.current) {
        console.log('Producing audio...');
        const producer = await sendTransportRef.current.produce({
          track: audioTrack,
          appData: { kind: 'audio' }
        });
        console.log('Audio producer created:', producer.id);
        producersRef.current.audio = producer;
      }

      // Produce video
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && sendTransportRef.current) {
        console.log('Producing video...');
        const producer = await sendTransportRef.current.produce({
          track: videoTrack,
          appData: { kind: 'video' }
        });
        console.log('Video producer created:', producer.id);
        producersRef.current.video = producer;
      }

      // Add local participant
      setParticipants(prev => {
        const exists = prev.some(p => p.id === socketRef.current.id);
        if (!exists) {
          return [...prev, {
            id: socketRef.current.id,
            displayName: displayName,
            isLocal: true,
            isAudioMuted: false,
            isVideoMuted: false,
            isHandRaised: false
          }];
        }
        return prev;
      });

      setConnectionStatus('Connected');
      
    } catch (error) {
      console.error('Failed to get user media:', error);
      setConnectionStatus('Media access failed');
      toast.error('Failed to access camera/microphone');
    }
  };

  const consumeProducers = async (producersToConsume) => {
    console.log('Starting to consume producers:', producersToConsume);
    
    for (const producer of producersToConsume) {
      // Skip if it's our own producer
      if (producer.peerId === socketRef.current.id) {
        console.log('Skipping own producer');
        continue;
      }

      // Skip if already consuming
      if (consumersRef.current[producer.producerId]) {
        console.log('Already consuming producer:', producer.producerId);
        continue;
      }

      console.log(`Consuming ${producer.kind} from ${producer.displayName}`);

      try {
        // Request to consume
        const response = await new Promise((resolve, reject) => {
          socketRef.current.emit('consume', {
            producerId: producer.producerId,
            rtpCapabilities: device.rtpCapabilities,
            transportId: recvTransportRef.current.id
          }, (response) => {
            if (response.success) {
              resolve(response);
            } else {
              reject(new Error(response.error));
            }
          });
        });

        console.log('Consume response:', response);

        // Create consumer
        const consumer = await recvTransportRef.current.consume({
          id: response.id,
          producerId: response.producerId,
          kind: response.kind,
          rtpParameters: response.rtpParameters
        });

        console.log('Consumer created:', consumer.id);

        // Store consumer
        consumersRef.current[producer.producerId] = consumer;

        // Create stream from consumer track
        const stream = new MediaStream([consumer.track]);
        
        // Store remote stream
        setRemoteStreams(prev => ({
          ...prev,
          [producer.peerId]: {
            ...prev[producer.peerId],
            [producer.kind]: stream
          }
        }));

        // Resume consumer
        socketRef.current.emit('resume-consumer', { consumerId: consumer.id });

        console.log(`Successfully consuming ${producer.kind} from ${producer.displayName}`);

      } catch (error) {
        console.error('Failed to consume producer:', error);
      }
    }
  };

  // Event Handlers
  const handleNewProducer = useCallback(async (data) => {
    console.log('New producer arrived:', data);
    
    if (data.peerId !== socketRef.current.id && recvTransportRef.current) {
      await consumeProducers([data]);
    }
  }, []);

  const handlePeerJoined = useCallback((data) => {
    console.log('Peer joined:', data);
    toast.success(`${data.displayName} joined`);
    
    setParticipants(prev => {
      if (!prev.some(p => p.id === data.peerId)) {
        return [...prev, {
          id: data.peerId,
          displayName: data.displayName,
          isLocal: false,
          isAudioMuted: false,
          isVideoMuted: false,
          isHandRaised: false
        }];
      }
      return prev;
    });
  }, []);

  const handlePeerLeft = useCallback((data) => {
    console.log('Peer left:', data);
    setParticipants(prev => prev.filter(p => p.id !== data.peerId));
    setRemoteStreams(prev => {
      const newStreams = { ...prev };
      delete newStreams[data.peerId];
      return newStreams;
    });
  }, []);

  const handlePeerAudioToggled = useCallback((data) => {
    setParticipants(prev => prev.map(p =>
      p.id === data.peerId ? { ...p, isAudioMuted: data.muted } : p
    ));
  }, []);

  const handlePeerVideoToggled = useCallback((data) => {
    setParticipants(prev => prev.map(p =>
      p.id === data.peerId ? { ...p, isVideoMuted: !data.enabled } : p
    ));
  }, []);

  const handlePeerHandRaised = useCallback((data) => {
    setParticipants(prev => prev.map(p =>
      p.id === data.peerId ? { ...p, isHandRaised: data.raised } : p
    ));
  }, []);

  const handleNewMessage = useCallback((data) => {
    setMessages(prev => [...prev, data]);
  }, []);

  const handlePeerNameChanged = useCallback((data) => {
    setParticipants(prev => prev.map(p =>
      p.id === data.peerId ? { ...p, displayName: data.newName } : p
    ));
  }, []);

  // Control handlers
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
        socketRef.current.emit('toggle-audio', { muted: !audioTrack.enabled });
      }
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        socketRef.current.emit('toggle-video', { enabled: videoTrack.enabled });
      }
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true
        });
        
        const videoTrack = screenStream.getVideoTracks()[0];
        
        if (sendTransportRef.current) {
          await sendTransportRef.current.produce({
            track: videoTrack,
            appData: { kind: 'video', type: 'screen' }
          });
        }
        
        setIsScreenSharing(true);
        
        videoTrack.onended = () => {
          setIsScreenSharing(false);
        };
      }
    } catch (error) {
      console.error('Screen sharing failed:', error);
    }
  }, [isScreenSharing]);

  const toggleHand = useCallback(() => {
    const newValue = !isHandRaised;
    setIsHandRaised(newValue);
    socketRef.current.emit('raise-hand', { raised: newValue });
  }, [isHandRaised]);

  const sendMessage = useCallback((message) => {
    socketRef.current.emit('send-message', { message });
  }, []);

  const leaveCall = useCallback(() => {
    socketRef.current.emit('leave-room', {}, () => {
      cleanup();
      navigate('/');
    });
  }, [navigate]);

  // Render video tiles
  const renderVideoTiles = () => {
    const tiles = [];

    // Local video
    if (streams.local) {
      tiles.push(
        <div key="local">
          <VideoTile
            peer={{ displayName: `${displayName} (You)` }}
            stream={streams.local}
            isLocal={true}
            isAudioMuted={!isAudioEnabled}
            isVideoMuted={!isVideoEnabled}
          />
        </div>
      );
    }

    // Remote videos
    Object.entries(remoteStreams).forEach(([peerId, streams]) => {
      const participant = participants.find(p => p.id === peerId);
      const streamToUse = streams.video || streams.audio;
      
      if (streamToUse && participant) {
        tiles.push(
          <div key={peerId}>
            <VideoTile
              peer={participant}
              stream={streamToUse}
              isAudioMuted={participant.isAudioMuted}
              isVideoMuted={participant.isVideoMuted || !streams.video}
            />
          </div>
        );
      }
    });

    return tiles;
  };

  if (!isJoined) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-white text-xl">{connectionStatus}</h2>
          <p className="text-gray-400 mt-2">Room: {roomId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-950 flex flex-col">
      <Toaster />
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {renderVideoTiles()}
          {Object.keys(remoteStreams).length === 0 && (
            <div className="col-span-full text-center text-gray-400 py-8">
              Waiting for others to join...
            </div>
          )}
        </div>
      </div>

      <ControlBar
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
        isScreenSharing={isScreenSharing}
        isHandRaised={isHandRaised}
        participantsCount={participants.length}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={toggleScreenShare}
        onToggleHand={toggleHand}
        onOpenChat={() => setIsChatOpen(true)}
        onOpenParticipants={() => setIsParticipantsOpen(true)}
        onLeaveCall={leaveCall}
      />

      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={messages}
        onSendMessage={sendMessage}
        currentUser={{ id: socketRef.current?.id }}
      />

      <ParticipantsPanel
        isOpen={isParticipantsOpen}
        onClose={() => setIsParticipantsOpen(false)}
        participants={participants}
      />
    </div>
  );
};

export default Room;