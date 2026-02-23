import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuid } from "uuid";
import { Video, Users, Sparkles } from "lucide-react";
import toast from "react-hot-toast";

const Home = () => {
  const [joinCode, setJoinCode] = useState("");
  const [userName, setUserName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const navigate = useNavigate();

  const createMeet = () => {
    if (!userName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    
    setIsCreating(true);
    const roomId = uuid().slice(0, 8).toUpperCase();
    
    // Store user info
    localStorage.setItem('meetUser', JSON.stringify({
      name: userName,
      lastJoined: new Date().toISOString()
    }));
    
    setTimeout(() => {
      navigate(`/room/${roomId}`, {
        state: { userName, isHost: true }
      });
    }, 500);
  };

  const joinMeet = () => {
    if (!joinCode.trim()) {
      toast.error("Please enter a room code");
      return;
    }
    
    if (!userName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    
    setIsJoining(true);
    
    // Store user info
    localStorage.setItem('meetUser', JSON.stringify({
      name: userName,
      lastJoined: new Date().toISOString()
    }));
    
    setTimeout(() => {
      navigate(`/room/${joinCode.toUpperCase()}`, {
        state: { userName, isHost: false }
      });
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-all duration-300">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <header className="flex justify-between items-center mb-16">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
              <Video className="w-8 h-8 text-indigo-600 dark:text-indigo-300" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
              Meet<span className="text-indigo-600 dark:text-indigo-400">Hub</span>
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <a 
              href="#" 
              className="text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
            >
              Features
            </a>
            <a 
              href="#" 
              className="text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
            >
              Pricing
            </a>
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
              Sign In
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <div className="max-w-6xl mx-auto text-center mb-20">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 mb-6">
            <Sparkles className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">Premium Video Conferencing</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
            Connect with
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
              Crystal Clarity
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto">
            High-quality video meetings with screen sharing, recording, and real-time collaboration. 
            Join from anywhere, on any device.
          </p>
          
          <div className="flex items-center justify-center space-x-4 mb-16">
            <div className="flex -space-x-4">
              {[1, 2, 3, 4].map((i) => (
                <div 
                  key={i} 
                  className="w-12 h-12 rounded-full border-2 border-white dark:border-gray-800 bg-gradient-to-br from-indigo-400 to-purple-400"
                />
              ))}
            </div>
            <span className="text-gray-600 dark:text-gray-300">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">10,000+</span> meetings daily
            </span>
          </div>
        </div>

        {/* Main Actions */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 md:p-12">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">
                Start or Join a Meeting
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Enter your name and either create a new meeting or join an existing one
              </p>
            </div>
            
            {/* User Name Input */}
            <div className="mb-8">
              <label className="block text-gray-700 dark:text-gray-300 mb-3 font-medium">
                Your Name
              </label>
              <input
                type="text"
                placeholder="Enter your name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-6 py-4 text-lg border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 outline-none transition bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                maxLength={30}
              />
            </div>
            
            {/* Action Buttons */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Create Meeting Card */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 rounded-xl p-8 border-2 border-indigo-100 dark:border-indigo-900">
                <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl mb-6 mx-auto">
                  <Video className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4 text-center">
                  New Meeting
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-8 text-center">
                  Start an instant meeting with a unique room code
                </p>
                <button
                  onClick={createMeet}
                  disabled={isCreating}
                  className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isCreating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3" />
                      Creating...
                    </>
                  ) : (
                    "Create Meeting"
                  )}
                </button>
              </div>
              
              {/* Join Meeting Card */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-gray-800 rounded-xl p-8 border-2 border-emerald-100 dark:border-emerald-900">
                <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl mb-6 mx-auto">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4 text-center">
                  Join Meeting
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4 text-center">
                  Enter the meeting code provided by the host
                </p>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Enter meeting code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 text-center text-lg font-mono border-2 border-emerald-200 dark:border-emerald-800 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800 outline-none transition bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    maxLength={8}
                  />
                  <button
                    onClick={joinMeet}
                    disabled={isJoining}
                    className="w-full py-4 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all duration-300 transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {isJoining ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3" />
                        Joining...
                      </>
                    ) : (
                      "Join Meeting"
                    )}
                  </button>
                </div>
              </div>
            </div>
            
            {/* Quick Join Tips */}
            <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
                Quick Tips:
              </h4>
              <ul className="grid md:grid-cols-3 gap-4">
                <li className="flex items-center text-gray-600 dark:text-gray-400">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full mr-3" />
                  Use headphones for better audio
                </li>
                <li className="flex items-center text-gray-600 dark:text-gray-400">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full mr-3" />
                  Enable camera for face-to-face interaction
                </li>
                <li className="flex items-center text-gray-600 dark:text-gray-400">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full mr-3" />
                  Share your screen for collaboration
                </li>
              </ul>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <footer className="mt-20 text-center text-gray-500 dark:text-gray-400">
          <p className="text-sm">
            Secure, encrypted video meetings • No account required • 100% free
          </p>
          <p className="text-xs mt-2">
            By joining, you agree to our Terms of Service and Privacy Policy
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Home;