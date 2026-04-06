import { EventEmitter } from "node:events";
import type { FastifyBaseLogger } from "fastify";

class AppEventBus extends EventEmitter {
    private logger: FastifyBaseLogger | null = null;

    setEventLogger(logger: FastifyBaseLogger) {
        this.logger = logger;
    }

    override emit(event: string | symbol, ...args: unknown[]): boolean {
        if (typeof event === "string" && this.logger) {
            this.logger.debug({ event, data: args[0] }, "plugin:event");
        }
        return super.emit(event, ...args);
    }
}

export const appEvents = new AppEventBus();
appEvents.setMaxListeners(0);
