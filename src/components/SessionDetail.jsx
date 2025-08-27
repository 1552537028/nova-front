import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Chat from "./Chat.jsx";
import API_BASE from "../config";

export default function SessionDetail({ setSessionId }) {
  const { id } = useParams();
  const [conversation, setConversation] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadConversation = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/sessions/${id}`);
      if (res.status === 404) {
        alert("Session not found");
        return;
      }
      const data = await res.json();
      setConversation(data.messages);
      setSessionId(id);
    } catch (err) {
      console.error("Error loading conversation:", err);
      alert("Failed to load conversation");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversation();
  }, [id]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 max-w-5xl mx-auto w-full">
        {loading ? (
          <div className="text-center text-gray-500 text-sm sm:text-base">Loading...</div>
        ) : conversation.length === 0 ? (
          <div className="text-center text-gray-500 text-sm sm:text-base">No messages in this session</div>
        ) : (
          conversation.map((m, i) => {
            const baseClasses = "w-full max-w-[95%] sm:max-w-[90%] md:max-w-[85%] lg:max-w-[80%] rounded-lg p-3 sm:p-4 text-sm sm:text-base font-normal break-words";
            const specificClasses = m.role === "user" 
              ? "bg-blue-600 text-white" 
              : m.role === "assistant" 
              ? "bg-white border border-gray-200 shadow-sm" 
              : "bg-red-100 text-red-800 border border-red-300";
            
            return (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} w-full`}
              >
                <div className={`${baseClasses} ${specificClasses}`}>
                  <div className="text-xs font-medium mb-2 opacity-80">
                    {m.role.charAt(0).toUpperCase() + m.role.slice(1)} ({m.time})
                  </div>
                  <div dangerouslySetInnerHTML={{
                    __html: m.content
                      .replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-100 p-3 rounded-md my-2 overflow-x-auto text-sm"><code>$1</code></pre>')
                      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener" class="text-blue-600 hover:underline break-all">$1</a>')
                      .replace(/\n/g, '<br />')
                  }} />
                </div>
              </div>
            );
          })
        )}
     css
      </div>
      <Chat sessionId={id} />
    </div>
  );
}