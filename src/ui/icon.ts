import { el } from "./dom";

const urlMap = import.meta.glob("../assets/icons/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const byId: Record<string, string> = {};
for (const [path, url] of Object.entries(urlMap)) {
  const m = path.match(/\/([^/]+)\.png$/);
  if (m) byId[m[1]] = url;
}

export function iconUrl(id: string | undefined): string | undefined {
  return id ? byId[id] : undefined;
}

/**
 * Render an icon: an <img> for ids that have a bundled PNG, otherwise a <span>
 * containing the emoji fallback. The class is applied to whichever element
 * gets rendered so existing layout rules keep working.
 */
export function iconEl(
  id: string | undefined,
  fallback: string,
  klass = "icon",
): HTMLElement {
  const url = iconUrl(id);
  if (url) {
    return el("img", {
      class: `${klass} icon-img`,
      src: url,
      alt: "",
      "aria-hidden": "true",
      draggable: "false",
    });
  }
  return el("span", { class: klass }, fallback);
}
