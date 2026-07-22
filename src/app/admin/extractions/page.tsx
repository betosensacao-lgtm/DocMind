"use client";
import { useState, useEffect } from "react";
import { Database } from "lucide-react";

export default function ExtractionsPage() {
  const [extractions, setExtractions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats").then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      setExtractions([]);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Extractions</h1>
        <p className="text-sm text-muted-foreground mt-1">Data extracted from your documents</p>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-64"><p className="text-muted-foreground animate-pulse">Loading...</p></div>
      ) : extractions.length === 0 ? (
        <div className="border border-border rounded-xl p-12 text-center">
          <Database size={40} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No extractions yet. Upload and process a document first.</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="text-left p-3 font-medium">Field</th>
                <th className="text-left p-3 font-medium">Value</th>
                <th className="text-left p-3 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {extractions.map((ext: any) => (
                <tr key={ext.id} className="border-b border-border">
                  <td className="p-3 font-medium">{ext.fieldLabel}</td>
                  <td className="p-3">{ext.fieldValue}</td>
                  <td className="p-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ext.confidence >= 80 ? "bg-green-100 text-green-800" : ext.confidence >= 50 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}>{ext.confidence}%</span>
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
