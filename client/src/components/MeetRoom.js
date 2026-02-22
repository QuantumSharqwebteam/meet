import React, { useEffect, useContext, useRef } from "react";
import { useParams } from "react-router-dom";
import { VideoCallContext } from "../context/VideoCallContext";

const MeetRoom = () => {
  const { roomId } = useParams();
  const { localStream, peers, joinRoom } = useContext(VideoCallContext);
  const myVideoRef = useRef();

  useEffect(() => {
    joinRoom(roomId);
  }, [roomId]);

  useEffect(() => {
    if (myVideoRef.current && localStream) {
      myVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center p-4">
      <h2 className="text-white text-2xl font-semibold mb-4">Room: {roomId}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-6xl">
        {/* Local video */}
        <div className="bg-gray-800 rounded-lg overflow-hidden relative">
          <video
            ref={myVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 text-white bg-black bg-opacity-50 rounded px-2 py-1">
            You
          </div>
        </div>

        {/* Remote peers */}
        {Object.keys(peers).map((peerId) => (
          <div key={peerId} className="bg-gray-800 rounded-lg overflow-hidden relative">
            <video
              ref={peers[peerId].videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 text-white bg-black bg-opacity-50 rounded px-2 py-1">
              {peers[peerId].name || "Participant"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MeetRoom;
