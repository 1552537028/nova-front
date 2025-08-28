import { useState } from "react";
import { Route, BrowserRouter as Router, Routes, Link } from "react-router-dom";
import Home from "./components/Home.jsx";
import Sessions from "./components/Sessions.jsx";
import SessionDetail from "./components/SessionDetail.jsx";

export default function App() {
  const [sessionId, setSessionId] = useState("");

  return (
    <Router>
      <Routes>
        <Route path="/home" element={<Home sessionId={sessionId} setSessionId={setSessionId} />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/sessions/:id" element={<SessionDetail setSessionId={setSessionId} />} />
        <Route path="*" element={<Home sessionId={sessionId} setSessionId={setSessionId} />} />
      </Routes>
    </Router>
  );
}
