export function sortPluginIdsByRequires(
    ids: string[],
    requiresOf: (id: string) => string[]
): string[] {
    const result: string[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    function visit(id: string) {
        if (visited.has(id)) return;
        if (visiting.has(id)) {
            throw new Error(`Циклическая зависимость плагинов: ${id}`);
        }
        visiting.add(id);
        for (const dep of requiresOf(id)) {
            if (!ids.includes(dep)) {
                throw new Error(
                    `Плагин "${id}" требует "${dep}", но такого плагина нет`
                );
            }
            visit(dep);
        }
        visiting.delete(id);
        visited.add(id);
        result.push(id);
    }

    for (const id of ids) {
        visit(id);
    }
    return result;
}
