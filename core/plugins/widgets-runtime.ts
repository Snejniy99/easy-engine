import { existsSync } from "node:fs";
import { join } from "node:path";
import ejs from "ejs";
import type { PluginHost } from "./registers";
import { makePluginRouteOptions } from "./registers";
import type { WidgetSurface } from "./types";

function isPluginEnabled(host: PluginHost, pluginId: string): boolean {
    return host.ctx.pluginEnabledState.get(pluginId) !== false;
}

function escapeHtmlAttr(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;");
}

export function wrapWidgetMarkup(
    innerHtml: string,
    pluginId: string,
    widgetId: string,
    widgetKey: string
): string {
    return `<div class="widget-slot w-100" data-ee-widget="${escapeHtmlAttr(widgetKey)}" data-ee-widget-plugin="${escapeHtmlAttr(pluginId)}" data-ee-widget-id="${escapeHtmlAttr(widgetId)}">${innerHtml}</div>`;
}

export function normalizeWidgetLookupKey(raw: string): string {
    const t = raw.trim();
    if (!t) return "";
    const dot = t.indexOf(".");
    if (dot !== -1 && !t.includes(":")) {
        return `${t.slice(0, dot)}:${t.slice(dot + 1)}`;
    }
    return t;
}

export function createEeWidget(
    map: Map<string, string>
): (raw: string) => string {
    return (raw: string) => {
        const k = normalizeWidgetLookupKey(raw);
        if (!k) return "";
        return map.get(k) ?? "";
    };
}

export async function buildWidgetHtmlMap(
    surface: WidgetSurface,
    host: PluginHost,
    viewLocals: Record<string, unknown>
): Promise<Map<string, string>> {
    const list = host.widgets
        .filter((w) => w.surface === surface && isPluginEnabled(host, w.pluginId))
        .sort(
            (a, b) =>
                a.order - b.order ||
                a.pluginId.localeCompare(b.pluginId) ||
                a.widgetId.localeCompare(b.widgetId)
        );
    const map = new Map<string, string>();
    for (const w of list) {
        const opts = makePluginRouteOptions(
            host.ctx,
            host.pluginsDir,
            w.pluginId,
            `/p/${w.pluginId}`
        );
        const piece = await w.render(opts);
        if (!piece) continue;
        const file = join(
            host.ctx.rootDir,
            "plugins",
            w.pluginId,
            "views",
            piece.template
        );
        if (!existsSync(file)) continue;
        const key = `${w.pluginId}:${w.widgetId}`;
        const html = await ejs.renderFile(file, {
            ...viewLocals,
            ...piece.data,
            eeWidgetId: w.widgetId,
            eePluginId: w.pluginId,
            eeWidgetKey: key,
        });
        map.set(key, wrapWidgetMarkup(html, w.pluginId, w.widgetId, key));
    }
    return map;
}
