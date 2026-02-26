import React from 'react';
import { 
  Mic, MicOff, Video, VideoOff, Phone, Monitor, 
  MessageSquare, Users, Settings, ScreenShare, Hand 
} from 'lucide-react';
import { Button } from './ui/button';

const ControlBar = ({
  isAudioEnabled,
  isVideoEnabled,
  isScreenSharing,
  isHandRaised,
  participantsCount,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleHand,
  onOpenChat,
  onOpenParticipants,
  onLeaveCall
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900 to-gray-900/95 backdrop-blur-lg border-t border-gray-800">
      <div className="max-w-screen-xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left Section - Call Info */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-4 py-2">
              <Users className="w-5 h-5 text-gray-400" />
              <span className="text-white font-medium">{participantsCount}</span>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenParticipants}
              className="text-gray-400 hover:text-white"
            >
              Participants
            </Button>
          </div>

          {/* Center Section - Main Controls */}
          <div className="flex items-center gap-3">
            {/* Audio Control */}
            <Button
              variant={isAudioEnabled ? "secondary" : "destructive"}
              size="lg"
              onClick={onToggleAudio}
              className="rounded-full w-14 h-14"
            >
              {isAudioEnabled ? (
                <Mic className="w-6 h-6" />
              ) : (
                <MicOff className="w-6 h-6" />
              )}
            </Button>

            {/* Video Control */}
            <Button
              variant={isVideoEnabled ? "secondary" : "destructive"}
              size="lg"
              onClick={onToggleVideo}
              className="rounded-full w-14 h-14"
            >
              {isVideoEnabled ? (
                <Video className="w-6 h-6" />
              ) : (
                <VideoOff className="w-6 h-6" />
              )}
            </Button>

            {/* Screen Share */}
            <Button
              variant={isScreenSharing ? "default" : "secondary"}
              size="lg"
              onClick={onToggleScreenShare}
              className={`rounded-full w-14 h-14 ${
                isScreenSharing ? 'bg-green-600 hover:bg-green-700' : ''
              }`}
            >
              <Monitor className="w-6 h-6" />
            </Button>

            {/* End Call */}
            <Button
              variant="destructive"
              size="lg"
              onClick={onLeaveCall}
              className="rounded-full w-14 h-14 bg-red-600 hover:bg-red-700"
            >
              <Phone className="w-6 h-6 rotate-135" />
            </Button>
          </div>

          {/* Right Section - Extras */}
          <div className="flex items-center gap-2">
            {/* Raise Hand */}
            <Button
              variant={isHandRaised ? "default" : "ghost"}
              size="icon"
              onClick={onToggleHand}
              className={`rounded-full w-12 h-12 ${
                isHandRaised ? 'bg-yellow-600 hover:bg-yellow-700' : 'text-gray-400'
              }`}
            >
              <Hand className="w-5 h-5" />
            </Button>

            {/* Chat */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenChat}
              className="rounded-full w-12 h-12 text-gray-400 hover:text-white"
            >
              <MessageSquare className="w-5 h-5" />
            </Button>

            {/* Settings */}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full w-12 h-12 text-gray-400 hover:text-white"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlBar;