import React from 'react';
import { X, Mic, MicOff, Video, VideoOff, Hand } from 'lucide-react';
import { Button } from './ui/button';

const ParticipantsPanel = ({ isOpen, onClose, participants }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 bg-gray-900 border-l border-gray-800 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h3 className="text-white font-semibold">
          Participants ({participants.length})
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Participants List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {participants.map((participant) => (
            <div
              key={participant.id}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-800 transition"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white font-medium">
                      {participant.displayName?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  {participant.isHandRaised && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                      <Hand className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-white font-medium">
                    {participant.displayName}
                    {participant.isLocal && ' (You)'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {participant.isAudioMuted ? (
                      <MicOff className="w-3 h-3 text-red-400" />
                    ) : (
                      <Mic className="w-3 h-3 text-green-400" />
                    )}
                    {participant.isVideoMuted ? (
                      <VideoOff className="w-3 h-3 text-red-400" />
                    ) : (
                      <Video className="w-3 h-3 text-green-400" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ParticipantsPanel;