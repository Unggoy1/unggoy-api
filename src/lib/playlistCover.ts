import sharp from "sharp";
import prisma from "../prisma";
import { deleteFromS3, extractS3Key, uploadToS3 } from "./imageTools";

// Static placeholder used when a playlist has no maps to generate a cover from.
// Matches the Playlist.thumbnailUrl schema default.
export const PLAYLIST_PLACEHOLDER_URL = "/placeholder.webp";

// Output dimensions for the grid cover. ~16:9, retina-sized.
const COVER_WIDTH = 1120;
const COVER_HEIGHT = 640;
const TILE_WIDTH = COVER_WIDTH / 2;
const TILE_HEIGHT = COVER_HEIGHT / 2;
const WEBP_QUALITY = 80;

// How long to wait on a single map thumbnail download before giving up.
const FETCH_TIMEOUT_MS = 10000;

/**
 * Downloads a remote image (a map's thumbnail.jpg) into a Buffer.
 * Returns null on any failure so a single bad/slow thumbnail can't abort the
 * whole composite.
 */
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(`Failed to fetch map thumbnail ${url}:`, error);
    return null;
  }
}

/** Single full-bleed cover from one map thumbnail. */
async function buildSingleCover(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(COVER_WIDTH, COVER_HEIGHT, { fit: "cover", position: "centre" })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

/** 2x2 mosaic from exactly four map thumbnails. */
async function buildMosaicCover(buffers: Buffer[]): Promise<Buffer> {
  const tiles = await Promise.all(
    buffers.map((buffer) =>
      sharp(buffer)
        .resize(TILE_WIDTH, TILE_HEIGHT, { fit: "cover", position: "centre" })
        .toBuffer(),
    ),
  );

  return sharp({
    create: {
      width: COVER_WIDTH,
      height: COVER_HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([
      { input: tiles[0], left: 0, top: 0 },
      { input: tiles[1], left: TILE_WIDTH, top: 0 },
      { input: tiles[2], left: 0, top: TILE_HEIGHT },
      { input: tiles[3], left: TILE_WIDTH, top: TILE_HEIGHT },
    ])
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

/** Deletes a previously generated/uploaded cover, but only if it lives on our
 *  own storage (extractS3Key returns null for halowaypoint blobs, the
 *  placeholder, and empty strings). */
async function deleteStoredCover(url: string): Promise<void> {
  const key = extractS3Key(url);
  if (!key) return;
  try {
    await deleteFromS3(process.env.S3_BUCKET_NAME, key);
  } catch (error) {
    console.error(`Failed to delete old playlist cover ${key}:`, error);
  }
}

/**
 * Regenerates a playlist's cover from its maps and stores the result in
 * `thumbnailUrl`. No-op when the playlist has a user-uploaded cover.
 *
 * Ladder (mirrors the frontend):
 *  - 4+ maps -> 2x2 mosaic of the first four
 *  - 1-3 maps -> single cover from the first map
 *  - 0 maps   -> resets thumbnailUrl to the static placeholder image
 *
 * @param opts.skipIfFull  when true, bails out if the playlist already has more
 *   than 4 maps. Used on the add path: once the first-4 mosaic is full, an
 *   appended map can't change it, so there's nothing to regenerate.
 */
export async function regeneratePlaylistCover(
  playlistId: string,
  opts: { skipIfFull?: boolean } = {},
): Promise<void> {
  const playlist = await prisma.playlist.findUnique({
    where: { assetId: playlistId },
    select: { thumbnailUrl: true, hasCustomThumbnail: true },
  });

  // Gone, or the owner uploaded their own cover -> leave it alone.
  if (!playlist || playlist.hasCustomThumbnail) return;

  // First distinct maps in the playlist's natural (insertion) order. We only
  // need 5 to know whether the mosaic is "full" (4) with at least one to spare.
  const pairs = await prisma.ugcPair.findMany({
    where: { playlistId, mapAssetId: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { mapAssetId: true, map: { select: { thumbnailUrl: true } } },
  });

  const seen = new Set<string>();
  const mapThumbnails: string[] = [];
  let distinctMapCount = 0;
  for (const pair of pairs) {
    if (!pair.mapAssetId || seen.has(pair.mapAssetId)) continue;
    seen.add(pair.mapAssetId);
    distinctMapCount++;
    if (mapThumbnails.length < 4 && pair.map?.thumbnailUrl) {
      mapThumbnails.push(pair.map.thumbnailUrl);
    }
    if (distinctMapCount > 4) break;
  }

  // Add-path optimization: more than 4 maps already, first-4 unchanged.
  if (opts.skipIfFull && distinctMapCount > 4) return;

  const oldUrl = playlist.thumbnailUrl;

  // 0 maps -> reset to the static placeholder image.
  if (distinctMapCount === 0) {
    if (oldUrl !== PLAYLIST_PLACEHOLDER_URL) await deleteStoredCover(oldUrl);
    await prisma.playlist.update({
      where: { assetId: playlistId },
      data: { thumbnailUrl: PLAYLIST_PLACEHOLDER_URL },
    });
    return;
  }

  // Fetch the thumbnails we'll composite, dropping any that fail.
  const buffers = (await Promise.all(mapThumbnails.map(fetchImageBuffer))).filter(
    (buffer): buffer is Buffer => buffer !== null,
  );

  // Maps exist but nothing downloaded (transient failure / soft-deleted maps).
  // Leave the current cover untouched rather than blanking it.
  if (buffers.length === 0) return;

  const cover =
    buffers.length >= 4
      ? await buildMosaicCover(buffers.slice(0, 4))
      : await buildSingleCover(buffers[0]);

  const fileName = `playlist-cover-${playlistId}-${Date.now()}.webp`;
  await uploadToS3(cover, process.env.S3_BUCKET_NAME, fileName);
  const newUrl = `${process.env.IMAGE_DOMAIN}${fileName}`;

  // Swap in the new cover, then clean up the previous generated one.
  await prisma.playlist.update({
    where: { assetId: playlistId },
    data: { thumbnailUrl: newUrl },
  });
  if (oldUrl && oldUrl !== newUrl) await deleteStoredCover(oldUrl);
}

/**
 * Fire-and-forget cover regeneration for map removals (and custom-cover
 * removal). Always regenerates because a removed map may have been in the
 * first-4 mosaic.
 */
export function scheduleCoverRegeneration(playlistId: string): void {
  regeneratePlaylistCover(playlistId).catch((error) => {
    console.error(`Cover regeneration failed for playlist ${playlistId}:`, error);
  });
}

/**
 * Fire-and-forget cover regeneration for map additions. Skips the work when the
 * playlist already has more than 4 maps (the appended map can't change the
 * first-4 mosaic).
 */
export function scheduleCoverRegenerationOnMapAdd(playlistId: string): void {
  regeneratePlaylistCover(playlistId, { skipIfFull: true }).catch((error) => {
    console.error(`Cover regeneration failed for playlist ${playlistId}:`, error);
  });
}
