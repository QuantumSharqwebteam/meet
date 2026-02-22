import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuid } from "uuid";

const Home = () => {
  const [joinCode, setJoinCode] = useState("");
  const navigate = useNavigate();

  const createMeet = () => {
    const roomId = uuid().slice(0, 8);
    navigate(`/room/${roomId}`);
  };

  const joinMeet = () => {
    if (joinCode) navigate(`/room/${joinCode}`);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-500 to-indigo-600 p-4">
      <h1 className="text-4xl md:text-5xl font-bold text-white mb-8">My Meet App</h1>
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md flex flex-col gap-6">
        <button
          className="bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
          onClick={createMeet}
        >
          Create Meet
        </button>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter meet code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={joinMeet}
            className="bg-green-500 text-white px-4 py-3 rounded-lg font-semibold hover:bg-green-600 transition"
          >
            Join
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;
