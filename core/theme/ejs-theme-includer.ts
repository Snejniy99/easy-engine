import { join, normalize } from "node:path";
import { getThemedViewPath } from "./theme-runtime";

const THEME_VIEWS_RE =
    /^resources\/themes\/[a-z][a-z0-9-]*\/views\/(.+)$/;

function relFromProjectRoot(
    absolutePath: string,
    rootDir: string
): string | null {
    const norm = absolutePath.replace(/\\/g, "/");
    const rootNorm = rootDir.replace(/\\/g, "/");
    if (norm === rootNorm) return "";
    if (!norm.startsWith(rootNorm + "/")) return null;
    return norm.slice(rootNorm.length + 1);
}

function extractUnderViews(relFromProject: string): string | null {
    const engine = "resources/views/";
    if (relFromProject.startsWith(engine)) {
        return relFromProject.slice(engine.length);
    }
    const m = relFromProject.match(THEME_VIEWS_RE);
    if (m?.[1]) return m[1];
    return null;
}

export function createEjsThemeIncluder(rootDir: string) {
    return (originalPath: string, resolvedPath: string | undefined) => {
        const fallback =
            resolvedPath ?? join(rootDir, originalPath.replace(/^\//, ""));
        const tryRel = resolvedPath
            ? relFromProjectRoot(resolvedPath, rootDir)
            : relFromProjectRoot(fallback, rootDir);
        if (tryRel === null) {
            return { filename: normalize(fallback) };
        }
        const under = extractUnderViews(tryRel);
        if (!under) {
            return { filename: normalize(fallback) };
        }
        const themedRel = getThemedViewPath(under);
        return {
            filename: normalize(join(rootDir, ...themedRel.split("/"))),
        };
    };
}
