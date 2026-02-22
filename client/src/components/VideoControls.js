import React from "react";

const VideoControls = ({ toggleMic, toggleCamera, toggleScreen }) => {
  return (
    <div className="fixed bottom-4 flex gap-4 bg-black bg-opacity-50 p-3 rounded-full">
      <button
        onClick={toggleMic}
        className="bg-white text-black px-3 py-2 rounded-full hover:bg-gray-300 transition"
      >
        Mic
      </button>
      <button
        onClick={toggleCamera}
        className="bg-white text-black px-3 py-2 rounded-full hover:bg-gray-300 transition"
      >
        Camera
      </button>
      <button
        onClick={toggleScreen}
        className="bg-white text-black px-3 py-2 rounded-full hover:bg-gray-300 transition"
      >
        Share
      </button>
    </div>
  );
};

export default VideoControls;
