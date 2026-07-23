"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Activity, X } from "lucide-react";

export function RealtimeDashboard() {
  const [lastEvent, setLastEvent] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel("docmind-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "docmind", table: "docmind_documents" },
        (payload) => {
          console.log("Change received on docmind_documents!", payload);
          setLastEvent({ type: "document", data: payload });
          setIsVisible(true);
          toast.info(`Atualização de documento ao vivo!`);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "docmind", table: "extractions" },
        (payload) => {
          console.log("Change received on extractions!", payload);
          setLastEvent({ type: "extraction", data: payload });
          setIsVisible(true);
          toast.success(`Novos dados extraídos pela IA!`);
        }
      )
      .subscribe((status) => {
        console.log("Supabase Realtime Status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!isVisible || !lastEvent) return null;

  return (
    <div className="fixed bottom-4 left-4 bg-slate-900/90 backdrop-blur-md border border-slate-700/50 p-4 rounded-xl shadow-2xl z-50 animate-in slide-in-from-bottom-4 w-80">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400 animate-pulse" />
          <h4 className="text-sm font-semibold text-white">Live Update</h4>
        </div>
        <button onClick={() => setIsVisible(false)} className="text-slate-400 hover:text-white transition">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="bg-slate-950 p-2 rounded border border-slate-800 max-h-40 overflow-auto">
        <pre className="text-xs text-blue-400 font-mono">
          {JSON.stringify(lastEvent.data.new || lastEvent.data.old, null, 2)}
        </pre>
      </div>
    </div>
  );
}
