/**
 * Event-driven Server-Sent Events stream for live buggy snapshots.
 *
 * `/api/gps-beacon` broadcasts when telemetry arrives. A slower status refresh
 * keeps connection-state labels aging from online -> unstable -> offline even
 * when a device stops sending data.
 */
import {
  addBuggySseClient,
  removeBuggySseClient,
  sendBuggySnapshotToClient,
  sendBuggySsePing,
} from "@/lib/realtime/buggy-sse-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_INTERVAL_MS = 15_000;

export async function GET(request: Request) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const client = addBuggySseClient(controller);
      let closed = false;

      void sendBuggySnapshotToClient(client, { forceRefresh: true });

      const heartbeatInterval = setInterval(() => {
        sendBuggySsePing(client);
      }, HEARTBEAT_INTERVAL_MS);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeatInterval);
        removeBuggySseClient(client);

        try {
          controller.close();
        } catch {
          // The client may already have closed the stream.
        }
      };

      request.signal.addEventListener("abort", close, { once: true });
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
