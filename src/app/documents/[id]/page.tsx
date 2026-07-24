"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileText, Bot, Send, Sparkles, CheckCircle2, Copy } from "lucide-react";

interface DocDetails {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  pageCount: number;
  textContent: string;
  status: string;
  createdAt: string;
}

export default function DocumentDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [doc, setDoc] = useState<DocDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    { role: "assistant", content: "Olá! Faça qualquer pergunta ou peça um resumo/extração de dados sobre este documento." }
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch(`/api/documents/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setDoc(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMsg = input.trim();
    setInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: id,
          documentContent: doc?.textContent || "",
          message: userMsg,
        }),
      });

      const data = await res.json();
      const aiReply = data.reply || "Documento analisado com sucesso.";
      setChatMessages((prev) => [...prev, { role: "assistant", content: aiReply }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Erro ao consultar a IA sobre este documento." }]);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/documents"
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Documentos
          </Link>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-400" />
            <h1 className="font-semibold text-sm truncate max-w-md">{doc?.fileName || `Documento ${id}`}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3" />
            {doc?.status || "PRONTO"}
          </span>
          <span className="text-slate-400">{doc?.pageCount || 1} pág(s)</span>
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
        {/* Left Column: Document Reader Preview */}
        <div className="border-r border-slate-800 p-6 overflow-y-auto max-h-[calc(100vh-65px)] bg-slate-900/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Conteúdo do Documento</h2>
            <button
              onClick={() => navigator.clipboard.writeText(doc?.textContent || "")}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 bg-slate-800 px-2.5 py-1 rounded transition-colors"
            >
              <Copy className="w-3 h-3" /> Copiar Texto
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-sm text-slate-300 font-mono whitespace-pre-wrap leading-relaxed shadow-inner">
            {doc?.textContent || "Nenhum conteúdo de texto extraído."}
          </div>
        </div>

        {/* Right Column: Interactive AI RAG Assistant */}
        <div className="flex flex-col max-h-[calc(100vh-65px)] bg-slate-950">
          <div className="p-4 border-b border-slate-800 bg-slate-900/30 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-slate-200">Assistente IA RAG DocMind</h2>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 text-sm ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`p-4 rounded-2xl max-w-xl leading-relaxed ${
                    msg.role === "user"
                      ? "bg-teal-600 text-white rounded-br-none"
                      : "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex gap-3 items-center text-xs text-slate-500">
                <div className="w-6 h-6 rounded-full border border-teal-500/30 border-t-teal-400 animate-spin" />
                Analisando documento...
              </div>
            )}
          </div>

          {/* Chat Input Form */}
          <form onSubmit={handleSend} className="p-4 border-t border-slate-800 bg-slate-900/50 flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre contratos, valores, cláusulas, datas..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-medium text-sm flex items-center gap-2 transition-all shadow-lg shadow-teal-600/20"
            >
              <Send className="w-4 h-4" />
              Enviar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
