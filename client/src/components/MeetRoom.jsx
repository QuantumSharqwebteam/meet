import React, { useEffect, useContext, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { VideoCallContext } from "../context/VideoCallContext";
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  ScreenShare,
  ScreenShareOff,
  Circle,
  Square,
  Maximize2,
  Users,
  MessageSquare,
  Settings,
  Copy,
  Shield,
  Grid,
  LogOut,
  Loader2
} from "lucide-react";
import toast from "react-hot-toast";

const MeetRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    localStream,
    peers,
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
  } = useContext(VideoCallContext);
  
  const myVideoRef = useRef(null);
  const [gridView, setGridView] = useState(true);
  const [userName, setUserName] = useState("");
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const hasJoined = useRef(false);

  // Get user name
  useEffect(() => {
    const userFromState = location.state?.userName;
    if (userFromState) {
      setUserName(userFromState);
    } else {
      const savedUser = localStorage.getItem('meetUser');
      if (savedUser) {
        const { name } = JSON.parse(savedUser);
        setUserName(name);
      } else {
        setUserName(`User_${Math.random().toString(36).substr(2, 4)}`);
      }
    }
  }, [location]);

  // Join room on mount
  useEffect(() => {
    if (roomId && userName && !hasJoined.current) {
      hasJoined.current = true;
      joinRoom(roomId, userName);
    }
  }, [roomId, userName, joinRoom]);

  // Setup local video
  useEffect(() => {
    if (myVideoRef.current && localStream) {
      myVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Copy room ID
  const copyRoomId = useCallback(() => {
    navigator.clipboard.writeText(roomId);
    toast.success('Room ID copied!');
  }, [roomId]);

  // Handle leave
  const handleLeaveRoom = useCallback(() => {
    setShowLeaveConfirm(true);
  }, []);

  const confirmLeaveRoom = useCallback(() => {
    leaveRoom();
    setShowLeaveConfirm(false);
    navigate('/');
  }, [leaveRoom, navigate]);

  const cancelLeaveRoom = useCallback(() => {
    setShowLeaveConfirm(false);
  }, []);

  // Calculate grid
  const getGridColumns = () => {
    const totalParticipants = peers.size + 1;
    if (totalParticipants <= 2) return "grid-cols-1";
    if (totalParticipants <= 4) return "grid-cols-2";
    if (totalParticipants <= 9) return "grid-cols-3";
    return "grid-cols-4";
  };

  const getVideoSizeClass = () => {
    const totalParticipants = peers.size + 1;
    if (totalParticipants === 1) return "h-[80vh]";
    if (totalParticipants <= 4) return "h-96";
    return "h-64";
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Connecting to Room</h2>
          <p className="text-gray-400">Room ID: {roomId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Top Bar */}
      <div className="bg-gray-800/90 backdrop-blur-lg border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <div className="w-6 h-6 bg-indigo-500 rounded mr-3" />
            <h1 className="text-xl font-bold text-white">Video Meet</h1>
          </div>
          
          <div className="hidden md:flex items-center space-x-2 px-4 py-2 bg-gray-900 rounded-lg">
            <Shield className="w-4 h-4 text-green-400" />
            <span className="text-sm text-gray-300">Secure</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-center">
            <p className="text-sm text-gray-400">Meeting ID</p>
            <div className="flex items-center space-x-2">
              <code className="text-white font-mono font-bold text-lg">{roomId}</code>
              <button 
                onClick={copyRoomId}
                className="p-2 hover:bg-gray-700 rounded-lg transition"
                title="Copy meeting ID"
              >
                <Copy className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
          
          <div className="hidden md:flex items-center space-x-3">
            <span className="text-gray-400 text-sm">
              {peers.size + 1} participant{peers.size + 1 !== 1 ? 's' : ''}
            </span>
            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">{peers.size + 1}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button className="p-3 hover:bg-gray-700 rounded-lg transition">
            <Users className="w-5 h-5 text-gray-300" />
          </button>
          <button className="p-3 hover:bg-gray-700 rounded-lg transition">
            <MessageSquare className="w-5 h-5 text-gray-300" />
          </button>
          <button 
            onClick={() => setGridView(!gridView)}
            className="p-3 hover:bg-gray-700 rounded-lg transition"
            title="Toggle layout"
          >
            <Grid className="w-5 h-5 text-gray-300" />
          </button>
        </div>
      </div>

      {/* Main Video Area */}
      <div className="p-4 pt-8">
        <div className="max-w-7xl mx-auto">
          <div className={`grid ${gridView ? getGridColumns() : 'grid-cols-1'} gap-4`}>
            {/* Local video */}
            <div 
              className={`relative ${getVideoSizeClass()} bg-gray-800 rounded-2xl overflow-hidden group transition-all duration-300`}
            >
              <video
                ref={myVideoRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover"
              />
              
              <div className="absolute bottom-2 left-2 bg-black/70 text-white px-3 py-1 rounded-lg">
                <span className="font-semibold">{userName} (You)</span>
              </div>
              
              {isAudioMuted && (
                <div className="absolute top-2 left-2 bg-red-500/80 p-2 rounded-full">
                  <MicOff className="w-4 h-4 text-white" />
                </div>
              )}
              
              {isVideoOff && (
                <div className="absolute top-2 left-10 bg-red-500/80 p-2 rounded-full">
                  <VideoOff className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
            
            {/* Remote videos */}
            {Array.from(peers.values()).map((peer) => (
              <div
                key={peer.id}
                className={`relative ${getVideoSizeClass()} bg-gray-800 rounded-2xl overflow-hidden group transition-all duration-300`}
              >
                {peer.videoRef.current?.srcObject ? (
                  <video
                    ref={peer.videoRef}
                    autoPlay
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-gray-700">
                    <div className="text-center">
                      <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl text-white font-bold">
                          {peer.displayName?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      </div>
                      <p className="text-white font-medium">{peer.displayName}</p>
                    </div>
                  </div>
                )}
                
                <div className="absolute bottom-2 left-2 bg-black/70 text-white px-3 py-1 rounded-lg">
                  <span className="font-semibold">{peer.displayName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <div className="flex items-center space-x-4 bg-gray-900/90 backdrop-blur-lg rounded-2xl px-6 py-4 shadow-2xl border border-gray-700">
          {/* Audio Control */}
          <button
            onClick={toggleAudio}
            disabled={!isInRoom}
            className={`p-4 rounded-full transition-all duration-300 transform hover:scale-110 ${
              isAudioMuted 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-gray-700 hover:bg-gray-600'
            } ${!isInRoom ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={isAudioMuted ? "Unmute microphone" : "Mute microphone"}
          >
            {isAudioMuted ? (
              <MicOff className="w-6 h-6 text-white" />
            ) : (
              <Mic className="w-6 h-6 text-white" />
            )}
          </button>

          {/* Video Control */}
          <button
            onClick={toggleVideo}
            disabled={!isInRoom}
            className={`p-4 rounded-full transition-all duration-300 transform hover:scale-110 ${
              isVideoOff 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-gray-700 hover:bg-gray-600'
            } ${!isInRoom ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={isVideoOff ? "Turn camera on" : "Turn camera off"}
          >
            {isVideoOff ? (
              <VideoOff className="w-6 h-6 text-white" />
            ) : (
              <Video className="w-6 h-6 text-white" />
            )}
          </button>

          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            disabled={!isInRoom}
            className={`p-4 rounded-full transition-all duration-300 transform hover:scale-110 ${
              isScreenSharing 
                ? 'bg-blue-500 hover:bg-blue-600' 
                : 'bg-gray-700 hover:bg-gray-600'
            } ${!isInRoom ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={isScreenSharing ? "Stop screen sharing" : "Share screen"}
          >
            {isScreenSharing ? (
              <ScreenShareOff className="w-6 h-6 text-white" />
            ) : (
              <ScreenShare className="w-6 h-6 text-white" />
            )}
          </button>

          {/* Recording */}
          <button
            onClick={toggleRecording}
            disabled={!isInRoom}
            className={`p-4 rounded-full transition-all duration-300 transform hover:scale-110 ${
              isRecording 
                ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                : 'bg-gray-700 hover:bg-gray-600'
            } ${!isInRoom ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={isRecording ? "Stop recording" : "Start recording"}
          >
            {isRecording ? (
              <Square className="w-6 h-6 text-white" />
            ) : (
              <Circle className="w-6 h-6 text-white fill-red-500" />
            )}
          </button>

          {/* Leave Call */}
          <button
            onClick={handleLeaveRoom}
            className="p-4 bg-red-600 hover:bg-red-700 rounded-full transition-all duration-300 transform hover:scale-110"
            title="Leave call"
          >
            <LogOut className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>
      
      {/* Leave Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl p-8 max-w-md w-full border border-gray-700">
            <h3 className="text-2xl font-bold text-white mb-4">
              Leave Meeting?
            </h3>
            <p className="text-gray-300 mb-8">
              Are you sure you want to leave this meeting?
            </p>
            <div className="flex space-x-4">
              <button
                onClick={cancelLeaveRoom}
                className="flex-1 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmLeaveRoom}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Connection Status */}
      {!isInRoom && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50">
          <div className="flex items-center px-4 py-2 bg-yellow-600 rounded-lg shadow-lg">
            <Circle className="w-4 h-4 text-white mr-2 animate-pulse" />
            <span className="text-white font-semibold">Connecting...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetRoom;