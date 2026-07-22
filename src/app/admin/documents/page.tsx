"use client";
import { useState, useEffect } from "react";
import { Upload, FileText, Trash2 } from "lucide-react";
import { formatDate, formatFileSize } from "@/lib/utils";
import { toast } from "sonner";

interface Document {
  id: string; fileName: string; fileType: string; fileSize: number; status: string; pageCount: number; createdAt: string;
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { fetchDocs(); }, []);

  async function fetchDocs() {
    try {
      const res = await fetch("/api/admin/documents");
      if (!res.ok) return;
      setDocs(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/documents", { method: "POST", body: formData });
      if (!res.ok) { toast.error("Upload failed"); return; }
      toast.success("Document uploaded!");
      fetchDocs();
    } catch { toast.error("Upload error"); }
    finally { setUploading(false); }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
      toast.success("Document deleted");
      fetchDocs();
    } catch { toast.error("Delete failed"); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">Upload and manage your documents</p>
        </div>
        <label className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 cursor-pointer">
          <Upload size={16} /> {uploading ? "Uploading..." : "Upload"}
          <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.txt,.csv,.json,.md" disabled={uploading} />
        </label>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><p className="text-muted-foreground animate-pulse">Loading...</p></div>
      ) : docs.length === 0 ? (
        <div className="border border-border rounded-xl p-12 text-center">
          <FileText size={40} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No documents yet. Upload your first document!</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium hidden sm:table-cell">Pages</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Size</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium hidden lg:table-cell">Date</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr key={doc.id} className="border-b border-border hover:bg-muted/50">
                  <td className="p-3 font-medium">{doc.fileName}</td>
                  <td className="p-3 text-muted-foreground hidden sm:table-cell">{doc.pageCount ?? "-"}</td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">{formatFileSize(doc.fileSize)}</td>
                  <td className="p-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${doc.status === "READY" ? "bg-green-100 text-green-800" : doc.status === "ERROR" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>{doc.status}</span>
                  </td>
                  <td className="p-3 text-muted-foreground text-xs hidden lg:table-cell">{formatDate(new Date(doc.createdAt))}</td>
                  <td className="p-3">
                    <button onClick={() => handleDelete(doc.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
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
