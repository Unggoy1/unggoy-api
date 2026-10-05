// Builds the `.playlist.json` file consumed by the community Halo Infinite
// dedicated server. Limits below come from that server's agent:
//  - entry names are cut (silently, from the end) past 80 UTF-8 bytes
//  - ids are hard-capped at 80 bytes; short ASCII slugs (<= 24 bytes) keep
//    the 4-option ballot well under its 1200 byte message cap
//  - &, <, > each cost 6 bytes once escaped for players, so we drop them
//  - the vote overlay shows ~30 characters before its own "…"

export const NAME_MAX_BYTES = 80;
export const ID_MAX_BYTES = 24;
const ELLIPSIS = "…";
const NAME_SEPARATOR = " on ";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

export interface ExportableAsset {
  assetId: string;
  versionId: string;
  name: string;
  deletedAt?: Date | null;
}

export interface ExportablePairInput {
  map: ExportableAsset | null;
  gamemode: ExportableAsset | null;
}

export interface CompletePair {
  map: ExportableAsset;
  gamemode: ExportableAsset;
}

export interface PlaylistExportEntry {
  id: string;
  name: string;
  map: { asset_id: string; version_id: string };
  mode: { asset_id: string; version_id: string };
}

export interface PlaylistExport {
  schema_version: 1;
  selection: "shuffle_bag";
  entries: PlaylistExportEntry[];
}

// Intl.Segmenter exists in Bun but not in this project's ES2021 lib typings.
// Cutting by grapheme keeps emoji and accented letters from being split.
const segmenter = new (Intl as any).Segmenter(undefined, {
  granularity: "grapheme",
});

export function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function graphemes(value: string): string[] {
  const segments: Iterable<{ segment: string }> = segmenter.segment(value);
  return Array.from(segments, (s) => s.segment);
}

function isUsableUuid(value: string | null | undefined): boolean {
  return !!value && UUID_PATTERN.test(value) && value !== NIL_UUID;
}

function isExportable(asset: ExportableAsset | null): asset is ExportableAsset {
  return (
    !!asset &&
    !asset.deletedAt &&
    isUsableUuid(asset.assetId) &&
    isUsableUuid(asset.versionId)
  );
}

/**
 * Keeps only pairs that have both a map and a mode (live, with valid ids),
 * dropping repeats of the same map+mode so a ballot never shows the same
 * option twice. Input order is preserved.
 */
export function getExportablePairs(
  pairs: ExportablePairInput[],
): CompletePair[] {
  const seen = new Set<string>();
  const result: CompletePair[] = [];
  for (const pair of pairs) {
    if (!isExportable(pair.map) || !isExportable(pair.gamemode)) continue;
    const key = `${pair.map.assetId}:${pair.gamemode.assetId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ map: pair.map, gamemode: pair.gamemode });
  }
  return result;
}

export function sanitizeEntryText(value: string): string {
  return value
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF\u2028\u2029]/g, "")
    .replace(/\s*&\s*/g, " and ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function renderPart(parts: string[], truncated: boolean): string {
  const text = parts.join("");
  return truncated ? text.trimEnd() + ELLIPSIS : text;
}

/**
 * Builds "Mode on Map", fitting it into NAME_MAX_BYTES by repeatedly trimming
 * whichever side is currently longer, so both the mode and the map stay
 * visible instead of the server chopping the map off the end.
 */
export function buildEntryName(modeName: string, mapName: string): string {
  const mode = { parts: graphemes(sanitizeEntryText(modeName)), cut: false };
  const map = { parts: graphemes(sanitizeEntryText(mapName)), cut: false };
  const compose = () =>
    renderPart(mode.parts, mode.cut) +
    NAME_SEPARATOR +
    renderPart(map.parts, map.cut);

  let name = compose();
  while (byteLength(name) > NAME_MAX_BYTES) {
    const modeBytes = byteLength(renderPart(mode.parts, mode.cut));
    const mapBytes = byteLength(renderPart(map.parts, map.cut));
    const side = mapBytes >= modeBytes ? map : mode;
    side.parts.pop();
    side.cut = true;
    name = compose();
  }
  return name;
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clip(slug: string, length: number): string {
  return slug.slice(0, length).replace(/-+$/, "");
}

/** "map-mode" slug, at most ID_MAX_BYTES, splitting the budget fairly. */
export function buildEntrySlug(mapName: string, modeName: string): string {
  const map = slugify(mapName);
  const mode = slugify(modeName);
  if (!map || !mode) return clip(map || mode, ID_MAX_BYTES) || "entry";

  const budget = ID_MAX_BYTES - 1; // one byte for the joining dash
  const mapLength = Math.min(
    map.length,
    Math.max(Math.ceil(budget / 2), budget - mode.length),
  );
  const mapPart = clip(map, mapLength);
  const modePart = clip(mode, budget - mapPart.length);
  return modePart ? `${mapPart}-${modePart}` : mapPart;
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  for (let n = 2; used.has(id); n++) {
    const suffix = `-${n}`;
    id = clip(base, ID_MAX_BYTES - suffix.length) + suffix;
  }
  used.add(id);
  return id;
}

export function buildPlaylistExport(pairs: CompletePair[]): PlaylistExport {
  const usedIds = new Set<string>();
  return {
    schema_version: 1,
    selection: "shuffle_bag",
    entries: pairs.map(({ map, gamemode }) => ({
      id: uniqueId(buildEntrySlug(map.name, gamemode.name), usedIds),
      name: buildEntryName(gamemode.name, map.name),
      map: { asset_id: map.assetId, version_id: map.versionId },
      mode: { asset_id: gamemode.assetId, version_id: gamemode.versionId },
    })),
  };
}

/**
 * Content-Disposition value for "{playlist name}.playlist.json", with an
 * ASCII fallback plus the RFC 5987 UTF-8 form for non-ASCII names.
 */
export function exportContentDisposition(playlistName: string): string {
  const base =
    playlistName
      .replace(/[\u0000-\u001F\u007F-\u009F\\/:*?"<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\.+$/, "") || "playlist";
  const filename = `${base}.playlist.json`;
  const asciiFallback = filename
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E]/g, "_");
  // encodeURIComponent leaves ' ( ) unescaped, but RFC 5987 doesn't allow them
  const encoded = encodeURIComponent(filename).replace(
    /['()]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
