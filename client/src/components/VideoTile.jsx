import React, { useRef, useEffect, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Volume2, Monitor } from 'lucide-react';

const VideoTile = ({ 
  peer, 
  stream, 
  isLocal = false,
  audioLevel = 0,
  isAudioMuted = false,
  isVideoMuted = false,
  isScreenSharing = false
}) => {
  const videoRef = useRef(null);
  const [isHovering, setIsHovering] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      console.log('Setting video source:', peer?.displayName, stream);
      videoRef.current.srcObject = stream;
      
      // Check if stream has video tracks
      const videoTracks = stream.getVideoTracks();
      setHasVideo(videoTracks.length > 0 && videoTracks[0].enabled);
      
      // Handle track changes
      const handleTrackEnded = () => {
        console.log('Track ended for:', peer?.displayName);
        setHasVideo(false);
      };
      
      videoTracks.forEach(track => {
        track.addEventListener('ended', handleTrackEnded);
      });
      
      return () => {
        videoTracks.forEach(track => {
          track.removeEventListener('ended', handleTrackEnded);
        });
      };
    }
  }, [stream, peer?.displayName]);

  // Monitor video enabled state
  useEffect(() => {
    if (stream) {
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        setHasVideo(videoTracks[0].enabled && !isVideoMuted);
      }
    }
  }, [stream, isVideoMuted]);

  // Get initials for avatar
  const getInitials = (name) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  // Generate consistent color based on name
  const getAvatarColor = (name) => {
    const colors = [
      'from-blue-500 to-blue-600',
      'from-purple-500 to-purple-600',
      'from-green-500 to-green-600',
      'from-yellow-500 to-yellow-600',
      'from-red-500 to-red-600',
      'from-indigo-500 to-indigo-600',
      'from-pink-500 to-pink-600',
      'from-teal-500 to-teal-600'
    ];
    
    if (!name) return colors[0];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash) + name.charCodeAt(i);
      hash = hash & hash;
    }
    
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  return (
    <div 
      className="relative rounded-xl overflow-hidden bg-gray-900 aspect-video group"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          hasVideo && !isVideoMuted ? 'opacity-100' : 'opacity-0'
        }`}
      />
      
      {/* Audio Visualization (if speaking) */}
      {audioLevel > 0.15 && !isAudioMuted && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 border-4 border-green-500 rounded-xl animate-pulse" />
        </div>
      )}

      {/* No Video Fallback */}
      {(!hasVideo || isVideoMuted) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${getAvatarColor(peer?.displayName)} flex items-center justify-center shadow-lg`}>
            <span className="text-4xl font-bold text-white">
              {getInitials(peer?.displayName)}
            </span>
          </div>
        </div>
      )}

      {/* Overlay Gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />

      {/* Peer Info */}
      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-medium bg-black/50 px-2 py-1 rounded-md backdrop-blur-sm flex items-center gap-1">
            {peer?.displayName} {isLocal && '(You)'}
            {isScreenSharing && <Monitor className="w-3 h-3 ml-1" />}
          </span>
        </div>
        
        {/* Audio Level Indicator */}
        {!isLocal && !isAudioMuted && (
          <div className="flex items-center gap-1">
            <div className="w-16 h-1 bg-gray-600 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-100"
                style={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Controls Overlay (on hover) */}
      {isHovering && !isLocal && (
        <div className="absolute top-2 right-2 flex gap-2">
          <button className="p-2 bg-black/50 rounded-full backdrop-blur-sm hover:bg-black/70 transition">
            <Volume2 className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      {/* Mute Indicators */}
      <div className="absolute top-2 left-2 flex gap-2">
        {isAudioMuted && (
          <div className="p-1.5 bg-red-500/90 rounded-full backdrop-blur-sm">
            <MicOff className="w-4 h-4 text-white" />
          </div>
        )}
        {isVideoMuted && (
          <div className="p-1.5 bg-red-500/90 rounded-full backdrop-blur-sm">
            <VideoOff className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoTile;