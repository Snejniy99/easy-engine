import { posix } from "node:path";

export const EE_REL_RESOURCES = "resources";
export const EE_REL_VIEWS = posix.join(EE_REL_RESOURCES, "views");
export const EE_REL_THEMES = posix.join(EE_REL_RESOURCES, "themes");
