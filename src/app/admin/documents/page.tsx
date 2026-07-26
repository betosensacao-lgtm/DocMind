"use client";
import { useState, useEffect } from "react";
import { Upload, FileText, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { formatDate, formatFileSize } from "@/lib/utils";
import { toast } from "sonner";

interface Document {
  id: string; fileName: string; fileType: string; fileSize: number; status: string; pageCount: number; createdAt: string;
}

interface DriveFile {
  id: string; name: string; mimeType: string; webViewLink?: string;
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);

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

  async function openDrivePicker() {
    setLoadingDrive(true);
    setShowDrivePicker(true);
    try {
      const res = await fetch("/api/drive/list");
      if (!res.ok) { toast.error("Connect Google Drive first in the sidebar"); setShowDrivePicker(false); return; }
      const data = await res.json();
      setDriveFiles(data.files || []);
    } catch { toast.error("Failed to list Drive files"); }
    finally { setLoadingDrive(false); }
  }

  async function importFromDrive(file: DriveFile) {
    setImporting(file.id);
    try {
      const res = await fetch("/api/drive/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: file.id, fileName: file.name, mimeType: file.mimeType }),
      });
      if (!res.ok) { toast.error("Import failed"); return; }
      toast.success("Imported from Drive!");
      setShowDrivePicker(false);
      fetchDocs();
    } catch { toast.error("Import error"); }
    finally { setImporting(null); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">Upload and manage your documents</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openDrivePicker} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted/50">
            <ExternalLink size={16} /> Import from Drive
          </button>
          <label className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 cursor-pointer">
            <Upload size={16} /> {uploading ? "Uploading..." : "Upload"}
            <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.docx,.xlsx,.txt,.csv,.json,.md" disabled={uploading} />
          </label>
        </div>
      </div>

      {showDrivePicker && (
        <div className="border border-border rounded-xl p-4 bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm">Import from Google Drive</h3>
            <button onClick={() => setShowDrivePicker(false)} className="text-muted-foreground hover:text-foreground text-sm">Close</button>
          </div>
          {loadingDrive ? (
            <div className="flex items-center justify-center py-8"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
          ) : driveFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No compatible files found in Drive.</p>
          ) : (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {driveFiles.map((f) => (
                <div key={f.id} className="flex items-center justify-between py-2 px-2 hover:bg-muted rounded-lg">
                  <div className="text-sm truncate flex-1">
                    <p className="font-medium truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{f.mimeType.split("/").pop()}</p>
                  </div>
                  <button onClick={() => importFromDrive(f)} disabled={importing === f.id}
                    className="text-xs bg-brand-600 text-white px-3 py-1 rounded-lg hover:bg-brand-700 disabled:opacity-50">
                    {importing === f.id ? "Importing..." : "Import"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64"><p className="text-muted-foreground animate-pulse">Loading...</p></div>
      ) : docs.length === 0 ? (
        <div className="border border-border rounded-xl p-12 text-center">
          <FileText size={40} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No documents yet. Upload or import from Google Drive!</p>
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
                  <td className="p-3 font-medium">
                    <a href={`/documents/${doc.id}`} className="text-teal-400 hover:underline flex items-center gap-1.5">
                      <FileText size={16} />
                      {doc.fileName}
                    </a>
                  </td>
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
