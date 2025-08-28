import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import API_BASE from "../config";

const preprocessText = (text) => {
  if (!text) return "";

  // Step 1: Clean up artifacts (remove extra spaces between characters, duplicate words)
  text = text.replace(/\b(\w)\s+(\w)\s+(\w)\b/g, "$1$2$3"); // Fix spaced-out words like "W h e n"
  text = text.replace(/,\s*(then|so)\b/g, "$1"); // Remove duplicate ",then" or ",so"

  // Step 2: Normalize line endings
  text = text.replace(/\r\n|\r/g, "\n");

  // Step 3: Protect LaTeX equations (inline and display)
  const latexPlaceholders = [];
  text = text.replace(/(\$\$[\s\S]*?\$\$|\$[^\$]*?\$)/g, (match) => {
    latexPlaceholders.push(match);
    return `__LATEX_${latexPlaceholders.length - 1}__`;
  });

  // Step 4: Protect malformed LaTeX equations (e.g., "= ... $$")
  text = text.replace(/=\s*([^\$]*?)\$\$/g, (match, content) => {
    latexPlaceholders.push(`$${content}$`);
    return `= __LATEX_${latexPlaceholders.length - 1}__`;
  });

  // Step 5: Protect potential LaTeX fragments (e.g., \frac, \pi, \int without delimiters)
  text = text.replace(
    /\\(frac|int|pi|psi|le|ge)\b(?:{[^{}]*})?(?:{[^{}]*})?/g,
    (match) => {
      latexPlaceholders.push(`$${match}$`);
      return `__LATEX_${latexPlaceholders.length - 1}__`;
    }
  );

  // Step 6: Protect quantum mechanics-specific patterns (e.g., u \frac{\pi x}{L})
  text = text.replace(
    /\b(u|du|dx)\s*\\frac\{([^}]*)\}\{([^}]*)\}/g,
    (match, varName, num, denom) => {
      latexPlaceholders.push(`$${varName} \\frac{${num}}{${denom}}$`);
      return `__LATEX_${latexPlaceholders.length - 1}__`;
    }
  );

  // Step 7: Remove spaces after ":" and "?" in bolded text (e.g., **Definite Integration: ** to **Definite Integration:**)
  text = text.replace(
    /(\*\*[^\*]+?)(:|\?)\s*(\*\*)/g,
    "$1$2$3"
  );

  text = text.replace(
    /([^\n])\n(?!\n|[*+]\s|\d+\.\s|#)/g,
    "$1 "
  );

  // Step 8: Add newline for LaTeX equations following a colon
  text = text.replace(
    /(:)\s*(\$\$[\s\S]*?\$\$|\$[^\$]*?\$)/g,
    "$1\n$2"
  );

  // Step 9: Remove spaces after "." and ":" in URLs
  text = text.replace(
    /(https?:\/\/[^\s<]*?)\s*([.:])\s*/g,
    (match, url, punct) => `${url}${punct}`
  );

  // Step 10: Limit excessive newlines, but allow up to two for readability
  text = text.replace(/\n{3,}/g, "\n\n");

  // Step 11: Merge single newlines, but preserve sentence-like structures
  text = text.replace(
    /([^\n])\n(?!\n|[-*+]\s*(__LATEX_\d+__)?|\d+\.\s|#|\s*__LATEX_\d+__|\b(Let|When|Therefore|If|Then)\b|[.,:;]$)/g,
    "$1 "
  );

  // Step 12: Trim leading/trailing whitespace
  text = text.trim();

  // Step 13: Format markdown elements
  // Add newlines around headings
  text = text.replace(/^(#+.*)$/gm, "\n\n$1\n\n");
  // Add newlines after list items (before non-list content)
  text = text.replace(/([-*+]\s.*)\n\n(?![-*+\d])/g, "$1\n\n\n");

  // Step 14: Handle specific text replacements and bolding
  text = text.replace(
    /Dividing by \$A e\^\{i\(kx \\omega t\)\}\$:/g,
    "**Dividing by $A e^{i(kx - \\omega t)}$:**"
  );
  text = text.replace(
    /Dividing by \$A e\^\{i\(kx - \\omega t\)\}\$:/g,
    "**Dividing by $A e^{i(kx - \\omega t)}$:**"
  );

  // Step 15: Restore LaTeX equations
  text = text.replace(/__LATEX_(\d+)__/g, (_, index) => latexPlaceholders[index]);

  // Step 16: Ensure spacing around inline equations
  text = text.replace(/(\$[^\$]+\$)\s*([^\s\$])/g, "$1 $2"); // Space after
  text = text.replace(/([^\s\$])\s*(\$[^\$]+\$)/g, "$1 $2"); // Space before

  // Step 17: Ensure display equations have proper spacing
  text = text.replace(/^(\$\$.*\$\$)$/gm, "\n$1\n");

  // Step 18: Clean up multiple consecutive newlines
  text = text.replace(/\n{3,}/g, "\n\n");

  return text;
};

export default function Chat({ sessionId: propSessionId }) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(propSessionId || null);
  const [isWebSearch, setIsWebSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [chatTitle, setChatTitle] = useState("New Chat");
  const [sessions, setSessions] = useState([]);
  const abortControllerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  useEffect(() => {
    fetchSessions();
    if (propSessionId) {
      loadSession(propSessionId);
    }
  }, [propSessionId]);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/sessions`);
      const data = await res.json();
      setSessions(data.sessions);
    } catch (err) {
      console.error("Error fetching sessions:", err);
    }
  };

  const generateSessionId = () => {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  const generateChatTitle = (firstMessage) => {
    const words = firstMessage.trim().split(' ').slice(0, 6).join(' ');
    return words.length > 40 ? words.substring(0, 40) + '...' : words;
  };

  const handleNewChat = () => {
    setMessages([]);
    setSessionId(null);
    setChatTitle("New Chat");
    setMessage("");
    setIsWebSearch(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoading(false);
  };

  const loadSession = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/sessions/${id}`);
      if (!res.ok) throw new Error("Failed to load session");
      const data = await res.json();
      setMessages(data.messages);
      setSessionId(id);
      const firstUserMsg = data.messages.find(m => m.role === "user")?.content || "Chat";
      setChatTitle(generateChatTitle(firstUserMsg));
      const lastMsg = data.messages[data.messages.length - 1];
      setIsWebSearch(lastMsg ? !!lastMsg.is_web_search : false);
    } catch (err) {
      console.error("Error loading session:", err);
      alert("Failed to load session");
    }
  };

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    if (!confirm("Are you sure you want to delete this session?")) return;
    try {
      const res = await fetch(`${API_BASE}/sessions/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.session_id !== id));
        if (sessionId === id) {
          handleNewChat();
        }
      } else {
        alert("Failed to delete session");
      }
    } catch (err) {
      console.error("Error deleting session:", err);
      alert("Failed to delete session");
    }
  };

  const handleSendMessage = async () => {
    const rawMessage = message;
    const cleanedMessage = preprocessText(rawMessage);

    if (!cleanedMessage || isLoading) return;

    let currentSessionId = sessionId;
    if (!currentSessionId) {
      currentSessionId = generateSessionId();
      setSessionId(currentSessionId);
      setChatTitle(generateChatTitle(cleanedMessage));
    }

    const endpoint = isWebSearch ? "/web_search" : `/chat/${currentSessionId}`;
    const userMessage = {
      role: "user",
      content: cleanedMessage,
      is_web_search: isWebSearch ? 1 : 0,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setMessage("");
    setIsLoading(true);

    if (abortControllerRef.current) abortControllerRef.current.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          message: cleanedMessage,
          session_id: currentSessionId,
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`Request failed: ${response.status}`);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "",
          is_web_search: isWebSearch ? 1 : 0,
          timestamp: new Date().toISOString(),
        },
      ]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedContent = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const trimmed = part.trim();
          if (!trimmed.startsWith("data:")) continue;

          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") continue;

          accumulatedContent += data + "\n";

          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last.role === "assistant") {
              return [
                ...prev.slice(0, -1),
                { ...last, content: preprocessText(accumulatedContent) },
              ];
            }
            return prev;
          });
        }
      }

      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last.role === "assistant") {
          return [
            ...prev.slice(0, -1),
            { ...last, content: preprocessText(accumulatedContent) },
          ];
        }
        return prev;
      });
    } catch (err) {
      if (err.name !== "AbortError") {
        setMessages((prev) => [
          ...prev,
          {
            role: "error",
            content: `## Error\n\n${err.message}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
      if (!sessionId) {
        fetchSessions(); // Refresh sessions after new chat creation
      }
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setMessages((prev) => {
      const newMessages = [...prev];
      const last = newMessages[newMessages.length - 1];
      if (last && last.role === "assistant") {
        if (last.content.trim() === "") {
          newMessages.pop();
        } else {
          last.content += "\n\n[Generation cancelled]";
        }
      }
      return newMessages;
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Sidebar */}
      <div style={{
        width: '300px',
        backgroundColor: '#ffffff',
        borderRight: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '16px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>Recent Chats</h2>
          <button
            onClick={handleNewChat}
            style={{
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#2563eb'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#3b82f6'}
          >
            New Chat
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sessions.map((s) => (
            <div
              key={s.session_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 16px',
                cursor: 'pointer',
                backgroundColor: sessionId === s.session_id ? '#f3f4f6' : 'transparent',
                transition: 'background-color 0.2s'
              }}
              onClick={() => loadSession(s.session_id)}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = sessionId === s.session_id ? '#f3f4f6' : '#f9fafb'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = sessionId === s.session_id ? '#f3f4f6' : 'transparent'}
            >
              <span style={{ flex: 1, fontSize: '14px', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.title}
              </span>
              <button
                onClick={(e) => handleDelete(s.session_id, e)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  padding: '4px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#fee2e2'}
                onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e5e7eb',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937', margin: 0 }}>
            {chatTitle}
          </h1>
          <span style={{
            fontSize: '12px',
            backgroundColor: isWebSearch ? '#dbeafe' : '#f3f4f6',
            color: isWebSearch ? '#1e40af' : '#374151',
            padding: '4px 12px',
            borderRadius: '9999px',
            fontWeight: '500'
          }}>
            {isWebSearch ? "🌐 Web Search" : "💬 Chat"}
          </span>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          maxWidth: '1024px',
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {messages.length === 0 ? (
            <div style={{
              textAlign: 'center',
              marginTop: '25%',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
              <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#1f2937' }}>
                Start a conversation
              </h2>
              <p style={{ fontSize: '16px' }}>
                Ask anything or toggle web search for real-time info
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {messages.map((msg, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    justifyContent: msg.role === "user" ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div style={{
                    maxWidth: '70%',
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: msg.role === "user" ? (msg.is_web_search ? '#3b82f6' : '#4f46e5') :
                                    msg.role === "error" ? '#fef2f2' :
                                    msg.is_web_search ? '#eff6ff' : '#ffffff',
                    color: msg.role === "user" ? '#ffffff' : msg.role === "error" ? '#dc2626' : '#1f2937',
                    border: msg.role === "error" ? '2px solid #ef4444' :
                            msg.is_web_search && msg.role !== "user" ? '1px solid #bfdbfe' :
                            msg.role !== "user" ? '1px solid #e5e7eb' : 'none',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    position: 'relative',
                    fontSize: '15px',
                    lineHeight: '1.5'
                  }}>
                    {msg.is_web_search && msg.role !== "user" && (
                      <div style={{
                        fontSize: '13px',
                        color: '#2563eb',
                        marginBottom: '8px',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        🌐 Web Search Results
                      </div>
                    )}
                    {msg.role === "assistant" && (
                      <button
                        onClick={() => copyToClipboard(msg.content)}
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          background: 'none',
                          border: 'none',
                          color: '#6b7280',
                          cursor: 'pointer',
                          fontSize: '14px',
                          opacity: '0.7',
                          transition: 'opacity 0.2s'
                        }}
                        onMouseOver={(e) => e.target.style.opacity = '1'}
                        onMouseOut={(e) => e.target.style.opacity = '0.7'}
                        title="Copy message"
                      >
                        📋
                      </button>
                    )}
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        h1: ({ node, ...props }) => (
                          <h1 style={{ fontSize: '22px', fontWeight: '700', margin: '12px 0' }} {...props} />
                        ),
                        h2: ({ node, ...props }) => (
                          <h2 style={{ fontSize: '18px', fontWeight: '600', margin: '10px 0' }} {...props} />
                        ),
                        h3: ({ node, ...props }) => (
                          <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '8px 0' }} {...props} />
                        ),
                        ul: ({ node, ...props }) => (
                          <ul style={{ paddingLeft: '20px', margin: '8px 0', lineHeight: '1.6' }} {...props} />
                        ),
                        ol: ({ node, ...props }) => (
                          <ol style={{ paddingLeft: '20px', margin: '8px 0', lineHeight: '1.6' }} {...props} />
                        ),
                        li: ({ node, ...props }) => (
                          <li style={{ margin: '4px 0' }} {...props} />
                        ),
                        table: ({ node, ...props }) => (
                          <table style={{
                            borderCollapse: 'collapse',
                            width: '100%',
                            margin: '12px 0',
                            border: '1px solid #e5e7eb'
                          }} {...props} />
                        ),
                        th: ({ node, ...props }) => (
                          <th style={{
                            border: '1px solid #e5e7eb',
                            padding: '10px',
                            backgroundColor: '#f9fafb',
                            fontWeight: '600'
                          }} {...props} />
                        ),
                        td: ({ node, ...props }) => (
                          <td style={{ border: '1px solid #e5e7eb', padding: '10px' }} {...props} />
                        ),
                        code: ({ node, inline, ...props }) => inline ? (
                          <code style={{
                            backgroundColor: '#f3f4f6',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '14px',
                            fontFamily: 'ui-monospace, SFMono-Regular, monospace'
                          }} {...props} />
                        ) : (
                          <code style={{
                            display: 'block',
                            backgroundColor: '#1f2937',
                            color: '#f9fafb',
                            padding: '12px',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                            overflowX: 'auto'
                          }} {...props} />
                        ),
                        p: ({ node, ...props }) => (
                          <p style={{ margin: '6px 0' }} {...props} />
                        ),
                        blockquote: ({ node, ...props }) => (
                          <blockquote style={{
                            borderLeft: '3px solid #d1d5db',
                            paddingLeft: '12px',
                            margin: '12px 0',
                            color: '#6b7280',
                            fontStyle: 'italic'
                          }} {...props} />
                        ),
                      }}
                    >
                      {preprocessText(msg.content)}
                    </ReactMarkdown>
                    <div style={{
                      fontSize: '12px',
                      color: msg.role === "user" ? 'rgba(255,255,255,0.7)' : '#9ca3af',
                      marginTop: '8px'
                    }}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div style={{
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e5e7eb',
          padding: '16px 24px'
        }}>
          <div style={{ maxWidth: '1024px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    resize: 'none',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    padding: '12px 40px 12px 12px',
                    fontSize: '15px',
                    lineHeight: '1.5',
                    minHeight: '44px',
                    maxHeight: '120px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    backgroundColor: '#ffffff',
                    ...(isLoading && { opacity: 0.6, cursor: 'not-allowed' })
                  }}
                  placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
                {isLoading && (
                  <div style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '16px',
                    color: '#6b7280'
                  }}>
                    ⏳
                  </div>
                )}
              </div>
              <button
                onClick={isLoading ? handleCancel : handleSendMessage}
                disabled={!isLoading && !message.trim()}
                style={{
                  padding: '10px 20px',
                  backgroundColor: (!isLoading && !message.trim()) ? '#d1d5db' : (isLoading ? '#ef4444' : '#3b82f6'),
                  color: '#ffffff',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '15px',
                  fontWeight: '500',
                  cursor: (!isLoading && !message.trim()) ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s',
                  minWidth: '80px'
                }}
                onMouseOver={(e) => {
                  if (!e.target.disabled) e.target.style.backgroundColor = isLoading ? '#dc2626' : '#2563eb';
                }}
                onMouseOut={(e) => {
                  if (!e.target.disabled) e.target.style.backgroundColor = isLoading ? '#ef4444' : '#3b82f6';
                }}
              >
                {isLoading ? 'Cancel' : 'Send'}
              </button>
              <button
                onClick={() => setIsWebSearch(!isWebSearch)}
                style={{
                  padding: '10px',
                  backgroundColor: isWebSearch ? '#3b82f6' : '#ffffff',
                  color: isWebSearch ? '#ffffff' : '#6b7280',
                  borderRadius: '8px',
                  border: isWebSearch ? 'none' : '1px solid #d1d5db',
                  fontSize: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  minWidth: '44px'
                }}
                title={isWebSearch ? 'Switch to Chat Mode' : 'Switch to Web Search Mode'}
                onMouseOver={(e) => {
                  if (!isWebSearch) {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.color = '#3b82f6';
                  } else {
                    e.target.style.backgroundColor = '#2563eb';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isWebSearch) {
                    e.target.style.borderColor = '#d1d5db';
                    e.target.style.color = '#6b7280';
                  } else {
                    e.target.style.backgroundColor = '#3b82f6';
                  }
                }}
              >
                🌐
              </button>
            </div>
            {sessionId && (
              <div style={{
                fontSize: '12px',
                color: '#9ca3af',
                marginTop: '8px',
                textAlign: 'center'
              }}>
                Session: {sessionId}
              </div>
            )}
          </div>
        </div>
      </div>

      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css"
      />
    </div>
  );
}