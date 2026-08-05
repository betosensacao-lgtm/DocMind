"use client";

import Link from "next/link";
import { ArrowRight, FileText, Database, Workflow, Zap, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-teal-500/30 overflow-hidden relative font-sans">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-950/30 via-slate-950 to-slate-950 -z-10" />
      <div className="absolute top-0 w-full h-px bg-gradient-to-r from-transparent via-teal-500/50 to-transparent opacity-50" />

      {/* Header */}
      <header className="fixed top-0 w-full border-b border-slate-800 bg-slate-950/60 backdrop-blur-md z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">
              DocMind
            </span>
          </div>
          <nav className="flex items-center gap-6">
            <Link
              href="/admin/login"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Admin Access
            </Link>
            <Link
              href="/admin/documents"
              className="group relative flex items-center gap-2 text-sm bg-gradient-to-r from-teal-500 to-indigo-600 text-white px-5 py-2.5 rounded-full font-semibold hover:opacity-90 transition-all shadow-lg shadow-teal-500/20"
            >
              Documents & Chat
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-32 text-center z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm font-medium mb-8">
          <Zap className="w-4 h-4 fill-current" />
          Multi-Format RAG & Intelligent Document Reader
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold max-w-5xl leading-tight tracking-tight">
          Intelligent Analysis of{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-emerald-300 to-purple-400">
            PDFs, DOCX and Spreadsheets
          </span>
        </h1>

        <p className="text-lg md:text-xl text-slate-400 max-w-3xl mt-8 leading-relaxed">
          DocMind reads contracts, reports, and spreadsheets using dense embeddings and contextual RAG. Ask questions, generate summaries, and extract structured data in seconds.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mt-12">
          <Link
            href="/admin/documents"
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-indigo-600 text-white px-8 py-4 rounded-full font-semibold text-lg shadow-xl shadow-teal-500/25 hover:scale-105 transition-all"
          >
            Upload and Analyze Document
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/admin/dashboard"
            className="flex items-center justify-center px-8 py-4 rounded-full font-semibold text-lg border border-slate-800 bg-slate-900/50 hover:bg-slate-800 transition-colors"
          >
            View RAG Dashboard
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full mt-28">
          {[
            {
              icon: FileText,
              title: "Native Multi-Format Parsing",
              desc: "Full support for reading PDF, Word (.docx), Excel (.xlsx), CSV, Markdown, and TXT.",
              color: "text-teal-400",
              bg: "bg-teal-400/10",
            },
            {
              icon: Sparkles,
              title: "Dense 1536D Vectorization",
              desc: "L2-normalized dense embeddings with Cosine Similarity search in PGVector.",
              color: "text-purple-400",
              bg: "bg-purple-400/10",
            },
            {
              icon: Database,
              title: "Contextual RAG Chat",
              desc: "Real-time conversation powered by context extracted directly from your documents.",
              color: "text-indigo-400",
              bg: "bg-indigo-400/10",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="border border-slate-800 bg-slate-900/40 backdrop-blur-md rounded-3xl p-8 text-left transition-all hover:border-slate-700 hover:bg-slate-900/80"
            >
              <div className={`w-12 h-12 rounded-2xl ${feature.bg} flex items-center justify-center mb-6`}>
                <feature.icon className={`w-6 h-6 ${feature.color}`} />
              </div>
              <h3 className="font-semibold text-xl mb-3 text-slate-100">{feature.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-slate-800 py-8 text-center text-sm text-slate-500 z-10 relative">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6">
          <p>© 2026 DocMind RAG Intelligence. All rights reserved.</p>
          <div className="flex gap-4 text-xs">
            <span className="hover:text-slate-300 cursor-pointer">PGVector</span>
            <span className="hover:text-slate-300 cursor-pointer">Multi-Format RAG</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
