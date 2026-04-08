import { useState, useRef, useEffect, useCallback } from "react";
import "./index.css";

const API = "http://localhost:8000";

function useApi() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("dr_apikey") || "");
  const saveKey = (k) => { setApiKey(k); localStorage.setItem("dr_apikey", k); };
  return { apiKey, saveKey };
}

// ── Particle background ────────────────────────────────────────────────────
function ParticleBg() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    const particles = Array.from({ length: 55 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      dx: (Math.random() - 0.5) * 0.25,
      dy: (Math.random() - 0.5) * 0.25,
      o: Math.random() * 0.4 + 0.08,
    }));

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(214, 158, 70, ${p.o})`;
        ctx.fill();
      });

      // Connect close particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(139, 92, 246, ${0.06 * (1 - dist / 110)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} className="particle-canvas" />;
}

// ── Upload zone ────────────────────────────────────────────────────────────
function UploadZone({ onUpload, loading }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file || !file.name.endsWith(".pdf")) return;
    onUpload(file);
  };

  return (
    <div
      className={`upload-zone ${drag ? "drag-over" : ""} ${loading ? "uploading" : ""}`}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
      onClick={() => !loading && inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept=".pdf" style={{ display: "none" }}
        onChange={e => handleFile(e.target.files[0])} />

      {loading ? (
        <div className="upload-loading">
          <div className="spinner-ring" />
          <p className="upload-text">Indexing document<span className="blink-dots">...</span></p>
        </div>
      ) : (
        <>
          <div className="upload-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#d69e46" strokeWidth="1.5" strokeLinecap="round" />
              <polyline points="14,2 14,8 20,8" stroke="#d69e46" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="12" y1="18" x2="12" y2="12" stroke="#d69e46" strokeWidth="1.5" strokeLinecap="round" />
              <polyline points="9,15 12,12 15,15" stroke="#d69e46" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <p className="upload-title">Drop your PDF here</p>
          <p className="upload-sub">or click to browse · any size</p>
        </>
      )}
    </div>
  );
}

// ── Source badge ───────────────────────────────────────────────────────────
function SourceBadge({ page, score }) {
  const color = score > 80 ? "#22c55e" : score > 50 ? "#f59e0b" : "#ef4444";
  return (
    <span className="source-badge" style={{ borderColor: color + "44", color }}>
      p.{page} · {score}%
    </span>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────
function Message({ msg, idx }) {
  const isUser = msg.role === "user";
  return (
    <div className={`msg-row ${isUser ? "msg-user" : "msg-ai"}`}
      style={{ animationDelay: `${idx * 0.04}s` }}>
      {!isUser && (
        <div className="msg-avatar ai-avatar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" fill="#d69e46" />
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="#d69e46" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      )}
      <div className={`msg-bubble ${isUser ? "bubble-user" : "bubble-ai"}`}>
        <p className="msg-text">{msg.content}</p>
        {msg.sources?.length > 0 && (
          <div className="sources-row">
            {msg.sources.map((s, i) => <SourceBadge key={i} page={s.page} score={s.score} />)}
          </div>
        )}
        {msg.web?.length > 0 && (
          <div className="web-results">
            <span className="web-label">Web</span>
            {msg.web.map((w, i) => (
              <a key={i} href={w.href} target="_blank" rel="noreferrer" className="web-link">{w.title}</a>
            ))}
          </div>
        )}
      </div>
      {isUser && <div className="msg-avatar user-avatar">U</div>}
    </div>
  );
}

// ── Typing indicator ───────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="msg-row msg-ai">
      <div className="msg-avatar ai-avatar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" fill="#d69e46" />
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="#d69e46" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <div className="msg-bubble bubble-ai typing-bubble">
        <span className="dot" /><span className="dot" /><span className="dot" />
      </div>
    </div>
  );
}

// ── Document stats card ────────────────────────────────────────────────────
function DocStats({ info, summary }) {
  if (!info) return null;
  return (
    <div className="doc-stats">
      <div className="doc-filename">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#d69e46" strokeWidth="1.5" />
          <polyline points="14,2 14,8 20,8" stroke="#d69e46" strokeWidth="1.5" />
        </svg>
        <span>{info.filename}</span>
      </div>
      <div className="stats-row">
        {[
          ["Pages", info.page_count],
          ["Chunks", info.chunk_count],
          ["Words", (info.word_count || 0).toLocaleString()],
        ].map(([label, val]) => (
          <div className="stat-chip" key={label}>
            <span className="stat-val">{val}</span>
            <span className="stat-label">{label}</span>
          </div>
        ))}
      </div>
      {summary && (
        <>
          <div className="summary-tags">
            {summary.key_topics?.map((t, i) => <span className="topic-tag" key={i}>{t}</span>)}
          </div>
          <p className="summary-text">{summary.summary}</p>
          <div className="doc-meta-row">
            <span className="meta-pill">{summary.document_type}</span>
            <span className="meta-pill">{summary.difficulty}</span>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const { apiKey, saveKey } = useApi();
  const [session, setSession] = useState(null);
  const [docInfo, setDocInfo] = useState(null);
  const [summary, setSummary] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [webMode, setWebMode] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [keyInput, setKeyInput] = useState(apiKey);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, thinking]);

  const handleUpload = async (file) => {
    if (!apiKey) { setError("Enter your Gemini API key first"); return; }
    setUploading(true); setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/upload`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setSession(data.session_id);
      setDocInfo(data);
      setMessages([]);

      // Auto-summarize
      const sumRes = await fetch(`${API}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: data.session_id, api_key: apiKey }),
      });
      if (sumRes.ok) setSummary(await sumRes.json());

      setMessages([{
        role: "ai", content: `I've indexed "${file.name}" — ${data.page_count} pages, ${data.chunk_count} chunks with cross-encoder reranking ready. What would you like to explore?`,
        sources: [], web: [],
      }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !session || thinking) return;
    const q = input.trim();
    setInput("");
    setMessages(m => [...m, { role: "user", content: q }]);
    setThinking(true); setError("");

    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: session, question: q, api_key: apiKey, web_search: webMode }),
      });
      if (!res.ok) throw new Error("Chat failed");
      const data = await res.json();
      setMessages(m => [...m, { role: "ai", content: data.answer, sources: data.sources, web: data.web_results }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setThinking(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const reset = async () => {
    if (session) await fetch(`${API}/session/${session}`, { method: "DELETE" }).catch(() => {});
    setSession(null); setDocInfo(null); setSummary(null); setMessages([]); setError("");
  };

  return (
    <div className="app">
      <ParticleBg />

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">DR</div>
          <div>
            <div className="logo-name">DeepRead</div>
            <div className="logo-ver">v2.0 · AI Research</div>
          </div>
        </div>

        <div className="sidebar-section">
          <label className="section-label">Gemini API Key</label>
          <div className="key-input-wrap">
            <input
              type={showKey ? "text" : "password"}
              className="key-input"
              placeholder="AIza..."
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              onBlur={() => saveKey(keyInput)}
            />
            <button className="key-toggle" onClick={() => setShowKey(s => !s)}>
              {showKey ? "hide" : "show"}
            </button>
          </div>
        </div>

        <div className="sidebar-section">
          <label className="section-label">Document</label>
          <UploadZone onUpload={handleUpload} loading={uploading} />
        </div>

        {session && (
          <div className="sidebar-section">
            <label className="section-label">AI Mode</label>
            <div className="mode-toggle">
              <button className={`mode-btn ${!webMode ? "mode-active" : ""}`} onClick={() => setWebMode(false)}>
                PDF Only
              </button>
              <button className={`mode-btn ${webMode ? "mode-active" : ""}`} onClick={() => setWebMode(true)}>
                PDF + Web
              </button>
            </div>
            <p className="mode-hint">
              {webMode ? "Answers use document + live web search" : "Answers grounded in your document"}
            </p>
          </div>
        )}

        <DocStats info={docInfo} summary={summary} />

        {session && (
          <button className="reset-btn" onClick={reset}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <polyline points="1,4 1,10 7,10" stroke="currentColor" strokeWidth="2" />
              <path d="M3.51 15a9 9 0 1 0 .49-4.5" stroke="currentColor" strokeWidth="2" />
            </svg>
            New Document
          </button>
        )}

        <div className="sidebar-footer">
          <div className="feature-list-sm">
            {["Cross-encoder reranking", "Confidence scoring", "Web search agent", "Persistent index", "Auto-summarization"].map(f => (
              <div className="feature-item" key={f}>
                <div className="feature-dot" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Main chat ── */}
      <main className="chat-main">
        <header className="chat-header">
          <div className="header-left">
            {docInfo ? (
              <>
                <span className="header-doc-name">{docInfo.filename}</span>
                <span className="header-sep">·</span>
                <span className="header-meta">{docInfo.page_count} pages</span>
                {webMode && <span className="web-badge">+ Web</span>}
              </>
            ) : (
              <span className="header-idle">Upload a document to begin</span>
            )}
          </div>
          <div className="header-right">
            {session && <div className="status-dot" />}
            <span className="header-status">{session ? "Ready" : "Idle"}</span>
          </div>
        </header>

        <div className="messages-area">
          {messages.length === 0 && !uploading && (
            <div className="empty-state">
              <div className="empty-glyph">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#d69e46" strokeWidth="1" />
                  <polyline points="14,2 14,8 20,8" stroke="#d69e46" strokeWidth="1" />
                  <line x1="16" y1="13" x2="8" y2="13" stroke="#d69e46" strokeWidth="1" strokeLinecap="round" />
                  <line x1="16" y1="17" x2="8" y2="17" stroke="#d69e46" strokeWidth="1" strokeLinecap="round" />
                  <polyline points="10,9 9,9 8,9" stroke="#d69e46" strokeWidth="1" strokeLinecap="round" />
                </svg>
              </div>
              <h2 className="empty-title">DeepRead is ready</h2>
              <p className="empty-sub">Upload a PDF from the sidebar to start your research session</p>
              <div className="empty-suggestions">
                {["Summarize the key findings", "What methodology was used?", "List all conclusions", "Compare with web sources"].map(s => (
                  <button key={s} className="suggestion-chip" onClick={() => { setInput(s); inputRef.current?.focus(); }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => <Message key={i} msg={msg} idx={i} />)}
          {thinking && <TypingIndicator />}
          {error && <div className="error-toast">{error}</div>}
          <div ref={bottomRef} />
        </div>

        <div className="input-area">
          <div className="input-wrapper">
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder={session ? "Ask anything about your document…" : "Upload a PDF to start…"}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={!session || thinking}
              rows={1}
            />
            <button
              className={`send-btn ${(!input.trim() || !session || thinking) ? "send-disabled" : ""}`}
              onClick={sendMessage}
              disabled={!input.trim() || !session || thinking}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" strokeWidth="2" />
                <polygon points="22,2 15,22 11,13 2,9" stroke="currentColor" strokeWidth="2" fill="currentColor" />
              </svg>
            </button>
          </div>
          <p className="input-hint">Enter to send · Shift+Enter for new line · {webMode ? "Web search ON" : "PDF only"}</p>
        </div>
      </main>
    </div>
  );
}
