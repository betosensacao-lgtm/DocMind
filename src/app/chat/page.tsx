"use client";

import { useState, useRef, useEffect } from "react";

export default function ChatPage() {
  const [messages, setMessages] = useState([{ role: "agent", content: "Hi! I'm DocMind. Upload a document or ask me anything about document analysis." }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    setMessages((p) => [...p, { role: "lead", content: msg }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, organizationId: "demo", conversationId: sessionId }),
      });
      const data = await res.json();
      setMessages((p) => [...p, { role: "agent", content: data.reply }]);
    } catch {
      setMessages((p) => [...p, { role: "agent", content: "Sorry, an error occurred." }]);
    } finally { setLoading(false); }
  }

  return (
    <div className="h-dvh flex flex-col max-w-2xl mx-auto border-x border-border">
      <header className="border-b border-border p-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">D</span>
        </div>
        <div>
          <h1 className="font-display font-semibold">DocMind</h1>
          <p className="text-xs text-muted-foreground">Document AI Assistant</p>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "agent" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${msg.role === "agent" ? "bg-muted rounded-bl-sm" : "bg-brand-600 text-white rounded-br-sm"}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && <div className="flex justify-start"><div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2 text-sm"><span className="animate-pulse">Thinking...</span></div></div>}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="border-t border-border p-4">
        <div className="flex gap-2">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about a document..." className="flex-1 px-4 py-2 rounded-lg border border-border bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-brand-600" disabled={loading} />
          <button type="submit" disabled={loading || !input.trim()} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">Send</button>
        </div>
      </form>
    </div>
  );
}
