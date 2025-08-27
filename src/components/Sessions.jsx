import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/Button.jsx";
import { Card } from "../ui/Card.jsx";
import API_BASE from "../config";

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const navigate = useNavigate();

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/sessions`);
      const data = await res.json();
      const sessionDetails = await Promise.all(
        data.sessions.map(async (sessionId) => {
          const sessionRes = await fetch(`${API_BASE}/sessions/${sessionId}`);
          const sessionData = await sessionRes.json();
          const userMessage = sessionData.messages.find(m => m.role === "user")?.content || "No user message";
          return { id: sessionId, prompt: userMessage };
        })
      );
      setSessions(sessionDetails);
    } catch (err) {
      console.error("Error fetching sessions:", err);
      alert("Failed to load sessions");
    }
  };

  const handleDelete = async (sessionId, e) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this session?")) return;
    try {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
      } else {
        alert("Failed to delete session");
      }
    } catch (err) {
      console.error("Error deleting session:", err);
      alert("Failed to delete session");
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  return (
    <div className="p-3 sm:p-6 max-w-5xl mx-auto w-full">
      <Card>
        <h2 className="text-lg sm:text-xl font-bold mb-4">📂 Sessions</h2>
        <ul className="space-y-2 max-h-[50vh] sm:max-h-[60vh] overflow-y-auto">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
              onClick={() => navigate(`/sessions/${s.id}`)}
            >
              <span className="text-sm sm:text-base truncate flex-1">{s.prompt}</span>
              <button
                onClick={(e) => handleDelete(s.id, e)}
                className="p-2 text-red-600 hover:text-red-800"
                title="Delete session"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}