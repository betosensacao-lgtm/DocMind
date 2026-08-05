"use client";

import { useState, useEffect } from "react";
import { Database, FileText, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";

interface DocExtraction {
  id: string;
  fileName: string;
  fileType: string;
  status: string;
  createdAt: string;
}

export default function ExtractionsPage() {
  const [documents, setDocuments] = useState<DocExtraction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/documents")
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        setDocuments(data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 text-slate-100">
      <div>
        <h1 className="font-display text-2xl font-bold">Extractions & RAG Intelligence</h1>
        <p className="text-sm text-slate-400 mt-1">Data and vectorizations extracted from your documents</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : documents.length === 0 ? (
        <div className="border border-slate-800 bg-slate-900/40 rounded-2xl p-12 text-center">
          <Database size={40} className="mx-auto text-slate-500 mb-4" />
          <p className="text-slate-400 text-sm">No documents processed for extraction yet. Upload a file first.</p>
          <Link
            href="/admin/documents"
            className="inline-flex items-center gap-2 mt-4 text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-xl transition-all"
          >
            Go to Documents <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="border border-slate-800 bg-slate-900/40 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 bg-slate-900/60 font-semibold text-sm text-slate-200">
            Vectorized & Extracted Documents
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                <th className="text-left p-4 font-medium">Document</th>
                <th className="text-left p-4 font-medium">Type</th>
                <th className="text-center p-4 font-medium">RAG Status</th>
                <th className="text-right p-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-medium">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
                        <FileText className="w-4 h-4" />
                      </div>
                      <span className="text-slate-200">{doc.fileName}</span>
                    </div>
                  </td>
                  <td className="p-4 text-slate-400 uppercase text-xs font-mono">{doc.fileType || "doc"}</td>
                  <td className="p-4 text-center">
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      VECTORIZED (1536D)
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <Link
                      href={`/documents/${doc.id}`}
                      className="text-xs text-teal-400 hover:text-teal-300 font-medium inline-flex items-center gap-1 bg-slate-800 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      View RAG Chat <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
