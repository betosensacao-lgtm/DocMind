"use client";
import { useState, useEffect } from "react";
import { FileText, CheckCircle, Database, Upload } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/admin/stats").then((r) => r.json()).then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground animate-pulse">Loading...</p></div>;

  const cards = [
    { label: "Total Documents", value: stats?.totalDocuments ?? 0, icon: FileText, color: "text-blue-600" },
    { label: "Ready", value: stats?.readyDocuments ?? 0, icon: CheckCircle, color: "text-green-600" },
    { label: "Extractions", value: stats?.totalExtractions ?? 0, icon: Database, color: "text-purple-600" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Document processing overview</p>
        </div>
        <button onClick={() => router.push("/admin/documents")} className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700">
          <Upload size={16} /> Upload Document
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{card.label}</span>
              <card.icon size={20} className={card.color} />
            </div>
            <p className="font-display text-3xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
