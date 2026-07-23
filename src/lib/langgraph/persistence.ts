import { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";

let _checkpointer: BaseCheckpointSaver | null = null;
let _setupPromise: Promise<void> | null = null;

export function getCheckpointer(): BaseCheckpointSaver {
  if (!_checkpointer) {
    const { Pool } = require("pg");
    const { PostgresSaver } = require("@langchain/langgraph-checkpoint-postgres");
    
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    _checkpointer = new PostgresSaver(pool);
    _setupPromise = (_checkpointer as any).setup();
    console.log("[Persistence] PostgresSaver conectado (pg)");
  }
  return _checkpointer;
}

export async function ensureCheckpointerSetup() {
  if (_setupPromise) {
    await _setupPromise;
  }
}
