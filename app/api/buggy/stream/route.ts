/**
 * Server-Sent Events stream for live buggy snapshots.
 *
 * Polls the process-local live store and emits only when position or connection
 * state changes. The hook can fall back to normal polling if SSE is unavailable.
 */
import { getBuggyLiveSnapshot } from "@/lib/realtime/buggy-live-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function formatSseMessage(data: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

function formatSseEvent(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: Request) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let lastUpdatedAt = -1;
      let lastConnectionFlags = "";

      const sendSnapshot = () => {
        if (closed) return;
        const snapshot = getBuggyLiveSnapshot();

        // Lacak perubahan status koneksi secara terpisah dari updatedAt agar
        // client tetap menerima update saat telemetry berhenti masuk.
        const connectionFlags = snapshot.buggies
          .map((b) => `${b.id}:${b.connectionStatus}:${b.lastSeenSecondsAgo}`)
          .join("|");
        const hasChanged =
          snapshot.updatedAt !== lastUpdatedAt ||
          connectionFlags !== lastConnectionFlags;

        if (!hasChanged) return;
        lastUpdatedAt = snapshot.updatedAt;
        lastConnectionFlags = connectionFlags;
        controller.enqueue(formatSseMessage(snapshot));
      };

      const sendHeartbeat = () => {
        if (closed) return;
        controller.enqueue(formatSseEvent("ping", { ts: Date.now() }));
      };

      const pollInterval = setInterval(sendSnapshot, 1_000);
      const heartbeatInterval = setInterval(sendHeartbeat, 15_000);
      sendSnapshot();

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
        controller.close();
      };

      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
