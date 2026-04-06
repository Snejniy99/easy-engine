import type { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import type { EngineWsHub } from "./hub";

function sendJson(socket: { send: (data: string) => void; readyState: number }, obj: unknown) {
    if (socket.readyState !== 1) return;
    socket.send(JSON.stringify(obj));
}

export async function registerEngineWebSocket(app: FastifyInstance, hub: EngineWsHub) {
    await app.register(websocket);

    app.get(
        "/ws",
        { websocket: true },
        (socket, request) => {
            const meta = hub.attach(socket, request);
            sendJson(socket, { op: "ready", clientId: meta.id });

            socket.on("message", (raw: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
                if (isBinary) return;
                let msg: unknown;
                try {
                    msg = JSON.parse(raw.toString());
                } catch {
                    sendJson(socket, { op: "error", message: "invalid json" });
                    return;
                }
                if (!msg || typeof msg !== "object") {
                    sendJson(socket, { op: "error", message: "invalid message" });
                    return;
                }
                const op = (msg as { op?: unknown }).op;
                if (op === "ping") {
                    sendJson(socket, { op: "pong" });
                    return;
                }
                if (op === "subscribe") {
                    const events = (msg as { events?: unknown }).events;
                    if (!Array.isArray(events) || !events.every((e) => typeof e === "string")) {
                        sendJson(socket, { op: "error", message: "subscribe requires events: string[]" });
                        return;
                    }
                    const rejected = hub.subscribe(socket, events as string[]);
                    sendJson(socket, {
                        op: "subscribed",
                        events: hub.listSubscriptions(socket),
                        rejected: rejected.length ? rejected : undefined,
                    });
                    return;
                }
                if (op === "unsubscribe") {
                    const events = (msg as { events?: unknown }).events;
                    if (!Array.isArray(events) || !events.every((e) => typeof e === "string")) {
                        sendJson(socket, { op: "error", message: "unsubscribe requires events: string[]" });
                        return;
                    }
                    hub.unsubscribe(socket, events as string[]);
                    sendJson(socket, { op: "unsubscribed", events: hub.listSubscriptions(socket) });
                    return;
                }
                if (op === "list") {
                    sendJson(socket, { op: "subscriptions", events: hub.listSubscriptions(socket) });
                    return;
                }
                if (op === "publish") {
                    const event = (msg as { event?: unknown }).event;
                    const data = (msg as { data?: unknown }).data;
                    if (typeof event !== "string") {
                        sendJson(socket, { op: "error", message: "publish requires event: string" });
                        return;
                    }
                    const ok = hub.tryClientPublish(socket, event, data);
                    if (!ok) {
                        sendJson(socket, { op: "error", message: "publish denied" });
                        return;
                    }
                    sendJson(socket, { op: "published", event });
                    return;
                }
                sendJson(socket, { op: "error", message: `unknown op: ${String(op)}` });
            });
        }
    );

    app.addHook("onClose", async () => {
        hub.closeAll();
    });
}
