import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { VideoCallProvider } from "./context/VideoCallContext";
import { ThemeProvider } from "./context/ThemeContext";
import { Toaster } from "react-hot-toast";
import Home from "./components/Home";
import MeetRoom from "./components/MeetRoom";
import Layout from "./components/Layout";
import NotFound from "./components/NotFound";


function App() {
  return (
    <ThemeProvider>
      <VideoCallProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/room/:roomId" element={<MeetRoom />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </Router>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#363636',
              color: '#fff',
            },
          }}
        />
      </VideoCallProvider>
    </ThemeProvider>
  );
}

export default App;