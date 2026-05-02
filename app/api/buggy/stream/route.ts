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
      let lastActiveFlags = "";

      const sendSnapshot = () => {
        if (closed) return;
        const snapshot = getBuggyLiveSnapshot();

        // Lacak perubahan isActive secara terpisah dari updatedAt
        // agar ketika GPS berhenti (isActive → false setelah 15 detik),
        // client langsung mendapat update tanpa menunggu refresh.
        const activeFlags = snapshot.buggies.map((b) => `${b.id}:${b.isActive ? 1 : 0}`).join("|");
        const hasChanged = snapshot.updatedAt !== lastUpdatedAt || activeFlags !== lastActiveFlags;

        if (!hasChanged) return;
        lastUpdatedAt = snapshot.updatedAt;
        lastActiveFlags = activeFlags;
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
