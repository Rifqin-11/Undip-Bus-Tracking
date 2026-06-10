/**
 * Server-Sent Events stream for live buggy snapshots.
 *
 * Polls the shared API snapshot and emits only when position or connection
 * state changes. This keeps SSE consistent with `/api/buggy` refreshes.
 */
import { getBuggyApiSnapshot } from "@/lib/realtime/buggy-api-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();
const STREAM_POLL_INTERVAL_MS = 5_000;

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
      let sending = false;

      const sendSnapshot = async () => {
        if (closed || sending) return;
        sending = true;

        try {
          const snapshot = await getBuggyApiSnapshot();

          // Lacak perubahan status koneksi secara terpisah dari updatedAt agar
          // client tetap menerima update saat telemetry berhenti masuk.
          const connectionFlags = snapshot.buggies
            .map((b) => `${b.id}:${b.connectionStatus}:${b.lastSeenSecondsAgo}`)
            .join("|");
          const hasChanged =
            snapshot.updatedAt !== lastUpdatedAt ||
            connectionFlags !== lastConnectionFlags;

          if (!hasChanged || closed) return;
          lastUpdatedAt = snapshot.updatedAt;
          lastConnectionFlags = connectionFlags;
          controller.enqueue(formatSseMessage(snapshot));
        } catch (err) {
          if (closed) return;
          const message =
            err instanceof Error ? err.message : "Failed to build buggy stream";
          controller.enqueue(formatSseEvent("error", { message }));
        } finally {
          sending = false;
        }
      };

      const sendHeartbeat = () => {
        if (closed) return;
        controller.enqueue(formatSseEvent("ping", { ts: Date.now() }));
      };

      const pollInterval = setInterval(sendSnapshot, STREAM_POLL_INTERVAL_MS);
      const heartbeatInterval = setInterval(sendHeartbeat, 15_000);
      void sendSnapshot();

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
