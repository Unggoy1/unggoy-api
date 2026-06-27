/**
 * One-off backfill: generates covers for every playlist that does NOT have a
 * user-uploaded thumbnail (hasCustomThumbnail = false).
 *
 * Safe to re-run: regeneratePlaylistCover is idempotent and skips custom covers.
 * Custom uploads are never touched.
 *
 * Usage:
 *   bun scripts/backfill-playlist-covers.ts
 *   bun --env-file=.env scripts/backfill-playlist-covers.ts
 *
 * Optional env knobs:
 *   BACKFILL_CONCURRENCY  how many playlists to process at once (default 5)
 */
import prisma from "../src/prisma";
import { regeneratePlaylistCover } from "../src/lib/playlistCover";

const CONCURRENCY = Number(process.env.BACKFILL_CONCURRENCY) || 5;
const PAGE_SIZE = 200;

async function main() {
  const total = await prisma.playlist.count({
    where: { hasCustomThumbnail: false },
  });
  console.log(
    `Backfilling covers for ${total} playlist(s) without a custom thumbnail ` +
      `(concurrency ${CONCURRENCY})...`,
  );

  let processed = 0;
  let failed = 0;
  let cursor: string | undefined;

  // Cursor-paginate by primary key so we never hold every playlist in memory
  // and stay stable while thumbnailUrl values are being updated underneath us.
  while (true) {
    const page = await prisma.playlist.findMany({
      where: { hasCustomThumbnail: false },
      select: { assetId: true },
      orderBy: { assetId: "asc" },
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { assetId: cursor }, skip: 1 } : {}),
    });

    if (page.length === 0) break;
    cursor = page[page.length - 1].assetId;

    // Process the page in bounded-concurrency chunks.
    for (let i = 0; i < page.length; i += CONCURRENCY) {
      const chunk = page.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map(({ assetId }) => regeneratePlaylistCover(assetId)),
      );

      for (let j = 0; j < results.length; j++) {
        processed++;
        const result = results[j];
        if (result.status === "rejected") {
          failed++;
          console.error(
            `  ✗ ${chunk[j].assetId}:`,
            result.reason instanceof Error ? result.reason.message : result.reason,
          );
        }
      }
      console.log(`  ...${processed}/${total} processed (${failed} failed)`);
    }
  }

  console.log(`Done. ${processed} processed, ${failed} failed.`);
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
