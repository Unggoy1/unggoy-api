import { describe, expect, it } from "bun:test";
import {
  buildEntryName,
  buildEntrySlug,
  buildPlaylistExport,
  byteLength,
  exportContentDisposition,
  getExportablePairs,
  ID_MAX_BYTES,
  NAME_MAX_BYTES,
} from "../src/lib/playlistExport";

const asset = (name: string, n: number, deletedAt: Date | null = null) => ({
  assetId: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  versionId: `11111111-0000-4000-8000-${String(n).padStart(12, "0")}`,
  name,
  deletedAt,
});

describe("getExportablePairs", () => {
  it("keeps only complete, live, unique map+mode pairs in order", () => {
    const map = asset("Interference", 1);
    const mode = asset("Fiesta Slayer", 2);
    const otherMode = asset("CTF", 3);
    const result = getExportablePairs([
      { map, gamemode: null },
      { map: null, gamemode: mode },
      { map, gamemode: mode },
      { map, gamemode: asset("Gone", 4, new Date()) },
      { map, gamemode: mode },
      { map, gamemode: otherMode },
      {
        map: { ...map, versionId: "00000000-0000-0000-0000-000000000000" },
        gamemode: otherMode,
      },
    ]);
    expect(result).toEqual([
      { map, gamemode: mode },
      { map, gamemode: otherMode },
    ]);
  });
});

describe("buildEntryName", () => {
  it("leaves short names alone", () => {
    expect(buildEntryName("Fiesta Slayer", "Interference")).toBe(
      "Fiesta Slayer on Interference",
    );
  });

  it("replaces & and strips < >", () => {
    expect(buildEntryName("Cops & Robbers", "<Big> Map")).toBe(
      "Cops and Robbers on Big Map",
    );
  });

  it("trims the longer side so both stay visible within 80 bytes", () => {
    const mode =
      "Super Mega Ultra Infection Deluxe Edition Remastered v2 Directors Cut";
    const map = "Kusini Bay";
    const name = buildEntryName(mode, map);
    expect(byteLength(name)).toBeLessThanOrEqual(NAME_MAX_BYTES);
    expect(name.endsWith(" on Kusini Bay")).toBe(true);
    expect(name).toContain("…");
  });

  it("splits the budget when both sides are long", () => {
    const long = "A".repeat(100);
    const name = buildEntryName(long, "B".repeat(100));
    expect(byteLength(name)).toBeLessThanOrEqual(NAME_MAX_BYTES);
    const [mode, map] = name.split(" on ");
    expect(Math.abs(byteLength(mode) - byteLength(map))).toBeLessThanOrEqual(1);
  });

  it("counts bytes, not characters, and never splits emoji", () => {
    const name = buildEntryName("🔥".repeat(30), "Café Ünggoy".repeat(5));
    expect(byteLength(name)).toBeLessThanOrEqual(NAME_MAX_BYTES);
    // a split surrogate pair would not survive a UTF-8 round trip
    expect(Buffer.from(name, "utf8").toString("utf8")).toBe(name);
  });
});

describe("buildEntrySlug", () => {
  it("builds a short ascii map-mode slug", () => {
    expect(buildEntrySlug("Interference", "Fiesta Slayer")).toBe(
      "interference-fiesta-slay",
    );
    expect(buildEntrySlug("Kusini Bay", "CTF")).toBe("kusini-bay-ctf");
  });

  it("stays within the byte budget and falls back for non-latin names", () => {
    const slug = buildEntrySlug("X".repeat(60), "Y".repeat(60));
    expect(byteLength(slug)).toBeLessThanOrEqual(ID_MAX_BYTES);
    expect(buildEntrySlug("砦", "モード")).toBe("entry");
    expect(buildEntrySlug("Café", "Ñandú")).toBe("cafe-nandu");
  });
});

describe("buildPlaylistExport", () => {
  it("produces the schema with unique ids", () => {
    const pairs = getExportablePairs([
      { map: asset("Same Map", 1), gamemode: asset("Same Mode", 2) },
      { map: asset("Same Map", 3), gamemode: asset("Same Mode", 4) },
      { map: asset("Same Map", 5), gamemode: asset("Same Mode", 6) },
    ]);
    const file = buildPlaylistExport(pairs);
    expect(file.schema_version).toBe(1);
    expect(file.selection).toBe("shuffle_bag");
    expect(file.entries.map((e) => e.id)).toEqual([
      "same-map-same-mode",
      "same-map-same-mode-2",
      "same-map-same-mode-3",
    ]);
    expect(file.entries[0]).toEqual({
      id: "same-map-same-mode",
      name: "Same Mode on Same Map",
      map: { asset_id: pairs[0].map.assetId, version_id: pairs[0].map.versionId },
      mode: {
        asset_id: pairs[0].gamemode.assetId,
        version_id: pairs[0].gamemode.versionId,
      },
    });
  });
});

describe("exportContentDisposition", () => {
  it("names the file after the playlist", () => {
    expect(exportContentDisposition("Unggoy Slayer")).toBe(
      `attachment; filename="Unggoy Slayer.playlist.json"; filename*=UTF-8''Unggoy%20Slayer.playlist.json`,
    );
  });

  it("strips unsafe characters and handles non-ascii", () => {
    expect(exportContentDisposition('a/b:"c"')).toContain(
      'filename="abc.playlist.json"',
    );
    expect(exportContentDisposition("Café's")).toBe(
      `attachment; filename="Cafe's.playlist.json"; filename*=UTF-8''Caf%C3%A9%27s.playlist.json`,
    );
    expect(exportContentDisposition("///")).toContain(
      'filename="playlist.playlist.json"',
    );
  });
});
