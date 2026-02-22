import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { VideoCallProvider } from "./context/VideoCallContext";
import Home from "./components/Home";
import MeetRoom from "./components/MeetRoom";

function App() {
  return (
    <VideoCallProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomId" element={<MeetRoom />} />
        </Routes>
      </Router>
    </VideoCallProvider>
  );
}

export default App;
