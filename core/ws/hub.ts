import { EventEmitter } from "node:events";
import type { FastifyRequest } from "fastify";
import type { WebSocket } from "ws";

const EVENT_NAME_RE = /^[a-zA-Z0-9:._*\-]{1,256}$/;

export interface WsConnectionMeta {
    id: string;
    request: FastifyRequest;
}

export type WsPublishFilter = (meta: WsConnectionMeta) => boolean;

export type WsPublishListener = (event: string, data: unknown) => void;

export type WsClientPublishGuard = (
    socket: WebSocket,
    meta: WsConnectionMeta,
    event: string,
    data: unknown
) => boolean;

export interface EngineWsApi {
    publish(
        event: string,
        data: unknown,
        opts?: { filter?: WsPublishFilter }
    ): void;
    onPublish(listener: WsPublishListener): () => void;
    allowClientPublish(guard: WsClientPublishGuard): () => void;
    readonly clientCount: number;
}

type ConnRecord = {
    meta: WsConnectionMeta;
    subs: Set<string>;
};

function isValidEventName(s: string): boolean {
    return typeof s === "string" && EVENT_NAME_RE.test(s);
}

function subscriptionMatches(sub: string, event: string): boolean {
    if (sub === "*") return true;
    if (sub === event) return true;
    if (sub.endsWith("*") && sub.length > 1) {
        const prefix = sub.slice(0, -1);
        return event.startsWith(prefix);
    }
    return false;
}

function wantsEvent(subs: Set<string>, event: string): boolean {
    for (const s of subs) {
        if (subscriptionMatches(s, event)) return true;
    }
    return false;
}

export class EngineWsHub extends EventEmitter {
    private connections = new Map<WebSocket, ConnRecord>();
    private clientPublishGuards: WsClientPublishGuard[] = [];

    readonly api: EngineWsApi;

    constructor() {
        super();
        const hub = this;
        this.setMaxListeners(0);
        this.api = {
            publish: (event, data, opts) => hub.publish(event, data, opts),
            onPublish: (listener) => {
                const wrapped = (p: { event: string; data: unknown }) =>
                    listener(p.event, p.data);
                hub.on("publish", wrapped);
                return () => hub.off("publish", wrapped);
            },
            allowClientPublish: (guard) => hub.addClientPublishGuard(guard),
            get clientCount() {
                return hub.connections.size;
            },
        };
    }

    addClientPublishGuard(guard: WsClientPublishGuard): () => void {
        this.clientPublishGuards.push(guard);
        return () => {
            const i = this.clientPublishGuards.indexOf(guard);
            if (i >= 0) this.clientPublishGuards.splice(i, 1);
        };
    }

    tryClientPublish(
        socket: WebSocket,
        event: string,
        data: unknown
    ): boolean {
        const rec = this.connections.get(socket);
        if (!rec || !isValidEventName(event)) return false;
        for (const g of this.clientPublishGuards) {
            try {
                if (g(socket, rec.meta, event, data)) {
                    this.publish(event, {
                        clientId: rec.meta.id,
                        t: Date.now(),
                        body: data,
                    });
                    return true;
                }
            } catch {
                /* ignore */
            }
        }
        return false;
    }

    attach(socket: WebSocket, request: FastifyRequest): WsConnectionMeta {
        const meta: WsConnectionMeta = {
            id: crypto.randomUUID(),
            request,
        };
        this.connections.set(socket, { meta, subs: new Set() });
        const onEnd = () => this.detach(socket);
        socket.once("close", onEnd);
        socket.once("error", onEnd);
        return meta;
    }

    detach(socket: WebSocket): void {
        this.connections.delete(socket);
    }

    getMeta(socket: WebSocket): WsConnectionMeta | undefined {
        return this.connections.get(socket)?.meta;
    }

    subscribe(socket: WebSocket, events: string[]): string[] {
        const rec = this.connections.get(socket);
        if (!rec) return [];
        const rejected: string[] = [];
        for (const e of events) {
            if (!isValidEventName(e)) {
                rejected.push(e);
                continue;
            }
            rec.subs.add(e);
        }
        return rejected;
    }

    unsubscribe(socket: WebSocket, events: string[]): void {
        const rec = this.connections.get(socket);
        if (!rec) return;
        for (const e of events) {
            rec.subs.delete(e);
        }
    }

    listSubscriptions(socket: WebSocket): string[] {
        const rec = this.connections.get(socket);
        if (!rec) return [];
        return [...rec.subs];
    }

    publish(
        event: string,
        data: unknown,
        opts?: { filter?: WsPublishFilter }
    ): void {
        if (!isValidEventName(event)) return;
        const line = JSON.stringify({ op: "event", event, data });
        for (const [socket, rec] of this.connections) {
            if (opts?.filter && !opts.filter(rec.meta)) continue;
            if (!wantsEvent(rec.subs, event)) continue;
            if (socket.readyState === 1) socket.send(line);
        }
        try {
            this.emit("publish", { event, data });
        } catch {
            /* ignore */
        }
    }

    closeAll(): void {
        for (const socket of this.connections.keys()) {
            try {
                socket.close(1001, "server shutdown");
            } catch {
                /* ignore */
            }
        }
        this.connections.clear();
    }
}

export function createWsApi(hub: EngineWsHub): EngineWsApi {
    return hub.api;
}
