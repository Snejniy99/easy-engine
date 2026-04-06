import type { PluginInfo } from "../bootstrap/context";
import { isAdminRole } from "../auth/access";
import type {
    PanelMenuItem,
    PanelMenuSectionId,
} from "../plugins/types";
import {
    enrichMenuTreeWithCoreMeta,
    inferMenuMinRoleFromHref,
    inferMenuSectionForSubtree,
} from "./infer-menu-from-href";

export type PanelMenuNode = {
    id: string;
    label: string;
    href?: string;
    active: boolean;
    open: boolean;
    children: PanelMenuNode[];
};

export type PanelMenuSectionBuilt = {
    id: string;
    label: string | null;
    nodes: PanelMenuNode[];
};

const SECTION_ORDER: PanelMenuSectionId[] = [
    "site",
    "public",
    "admin",
    "system",
];

const SECTION_LABEL: Record<PanelMenuSectionId, string> = {
    site: "Сайт",
    public: "Публичные страницы",
    admin: "Администрирование",
    system: "Система",
};

function roleRank(r: string): number {
    if (r === "admin") return 3;
    if (r === "moderator") return 2;
    if (r === "user") return 1;
    return 0;
}

function canSeeItem(
    userRole: string,
    minRole?: PanelMenuItem["minRole"]
): boolean {
    if (!minRole) return true;
    return roleRank(userRole) >= roleRank(minRole);
}

function filterTree(
    items: PanelMenuItem[],
    userRole: string
): PanelMenuItem[] {
    const out: PanelMenuItem[] = [];
    for (const x of items) {
        if (!canSeeItem(userRole, x.minRole)) continue;
        const children = x.children?.length
            ? filterTree(x.children, userRole)
            : undefined;
        if (x.href) {
            out.push({ ...x, children });
        } else if (children?.length) {
            out.push({ ...x, children });
        }
    }
    return out;
}

function hrefIsActive(href: string, path: string): boolean {
    const pn = path.replace(/\/$/, "") || "/";
    const hn = href.replace(/\/$/, "") || "/";
    if (pn === hn) return true;
    if (hn === "/") return false;
    if (hn === "/admin" || hn === "/app") return false;
    return pn.startsWith(`${hn}/`);
}

function markActive(items: PanelMenuItem[], path: string): PanelMenuNode[] {
    return items.map((item) => {
        const childBuilt = item.children?.length
            ? markActive(item.children, path)
            : [];
        const hrefActive = item.href ? hrefIsActive(item.href, path) : false;
        const childActive = childBuilt.some((c) => c.active || c.open);
        const active = Boolean(hrefActive);
        const open = Boolean(childActive || hrefActive);
        return {
            id: item.id,
            label: item.label,
            href: item.href,
            active,
            open,
            children: childBuilt,
        };
    });
}

function inferPanelSection(p: PluginInfo): PanelMenuSectionId {
    if (p.hasAdminSpace && !p.hasAppSpace && !p.hasPublicSpace) {
        return "admin";
    }
    if (!p.hasAdminSpace && p.hasAppSpace && !p.hasPublicSpace) {
        return "site";
    }
    if (!p.hasAdminSpace && !p.hasAppSpace && p.hasPublicSpace) {
        return "public";
    }
    if (p.hasAdminSpace && p.hasAppSpace) return "admin";
    return "site";
}

function prefixPluginMenuIds(
    pluginId: string,
    items: PanelMenuItem[]
): PanelMenuItem[] {
    return items.map((item) => ({
        ...item,
        id: `${pluginId}:${item.id}`,
        children: item.children?.length
            ? prefixPluginMenuIds(pluginId, item.children)
            : undefined,
    }));
}

function pluginUsesMenuBySection(p: PluginInfo): boolean {
    const m = p.panelMenuBySection;
    if (!m) return false;
    return Object.values(m).some((a) => Array.isArray(a) && a.length > 0);
}

export function buildPanelMenuSections(
    userRole: string,
    path: string,
    plugins: PluginInfo[]
): PanelMenuSectionBuilt[] {
    const siteRaw: PanelMenuItem[] = [
        { id: "core:home", label: "Главная", href: "/" },
        { id: "core:app", label: "Личный кабинет", href: "/app" },
    ];
    const publicRaw: PanelMenuItem[] = [];
    const adminRaw: PanelMenuItem[] = [
        {
            id: "core:admin-dash",
            label: "Панель управления",
            href: "/admin",
            minRole: "moderator",
        },
    ];
    const systemRaw: PanelMenuItem[] = [
        {
            id: "core:settings",
            label: "Настройки",
            href: "/admin/settings",
            minRole: "admin",
        },
    ];

    const rawBySection: Record<PanelMenuSectionId, PanelMenuItem[]> = {
        site: siteRaw,
        public: publicRaw,
        admin: adminRaw,
        system: systemRaw,
    };

    for (const p of plugins) {
        if (p.enabled === false) continue;
        if (pluginUsesMenuBySection(p)) {
            const by = p.panelMenuBySection!;
            for (const key of SECTION_ORDER) {
                const arr = by[key];
                if (!arr?.length) continue;
                for (const item of arr) {
                    const section = inferMenuSectionForSubtree(item, key);
                    const enriched = enrichMenuTreeWithCoreMeta(item, plugins);
                    rawBySection[section].push(
                        ...prefixPluginMenuIds(p.id, [enriched])
                    );
                }
            }
            continue;
        }
        if (p.panelMenu?.length) {
            const fallback = p.panelMenuSection ?? inferPanelSection(p);
            for (const item of p.panelMenu) {
                const section = inferMenuSectionForSubtree(item, fallback);
                const enriched = enrichMenuTreeWithCoreMeta(item, plugins);
                rawBySection[section].push(
                    ...prefixPluginMenuIds(p.id, [enriched])
                );
            }
        } else {
            if (p.hasAppSpace && !p.hideInAppSidebar) {
                siteRaw.push({
                    id: `${p.id}:app-auto`,
                    label: p.name,
                    href: `/app/${p.id}`,
                });
            }
            if (p.hasPublicSpace && !p.hideInPublicSidebar) {
                publicRaw.push({
                    id: `${p.id}:public-auto`,
                    label: p.name,
                    href: `/p/${p.id}`,
                });
            }
            if (p.hasAdminSpace && !p.hideInSidebar) {
                const href = `/admin/${p.id}`;
                adminRaw.push({
                    id: `${p.id}:admin-auto`,
                    label: p.name,
                    href,
                    minRole: inferMenuMinRoleFromHref(href, plugins),
                });
            }
        }
    }

    const sections: PanelMenuSectionBuilt[] = [];

    const pushSection = (
        id: PanelMenuSectionId,
        raw: PanelMenuItem[],
        visible: boolean
    ) => {
        if (!visible) return;
        const filtered = filterTree(raw, userRole);
        if (!filtered.length) return;
        sections.push({
            id,
            label: SECTION_LABEL[id],
            nodes: markActive(filtered, path),
        });
    };

    pushSection("site", siteRaw, true);
    pushSection("public", publicRaw, true);
    pushSection(
        "admin",
        adminRaw,
        roleRank(userRole) >= roleRank("moderator")
    );
    pushSection("system", systemRaw, isAdminRole(userRole));

    return sections;
}
