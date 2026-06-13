import { Prisma } from "@prisma/client";

// Maximum number of cover thumbnails surfaced per playlist.
const COVER_THUMBNAIL_LIMIT = 4;
// Pairs fetched per playlist before dedup. A buffer above the limit so that
// repeated maps (same map paired with multiple gamemodes) still yield up to
// COVER_THUMBNAIL_LIMIT distinct thumbnails.
const COVER_PAIR_FETCH_LIMIT = 16;

// Batched eager-load fragment for a playlist listing query. Pulls only the map
// thumbnail URL from each pair (maps only, gamemodes excluded) in the
// playlist's natural ordering. Spreading this into a `findMany`/`findManyAndCount`
// include keeps the cover thumbnails to a single join for all listed playlists.
export const coverThumbnailsInclude = {
  ugcPairs: {
    where: { mapAssetId: { not: null } },
    orderBy: { createdAt: "asc" },
    take: COVER_PAIR_FETCH_LIMIT,
    select: {
      map: {
        select: {
          thumbnailUrl: true,
        },
      },
    },
  },
} satisfies Prisma.PlaylistInclude;

type PlaylistWithCoverPairs = {
  ugcPairs: { map: { thumbnailUrl: string } | null }[];
};

// Replaces the eager-loaded `ugcPairs` with a deduped, ordered `coverThumbnails`
// array of up to COVER_THUMBNAIL_LIMIT map thumbnail URLs. Returns [] when the
// playlist has no thumbnailed maps.
export function withCoverThumbnails<T extends PlaylistWithCoverPairs>(
  playlist: T,
): Omit<T, "ugcPairs"> & { coverThumbnails: string[] } {
  const { ugcPairs, ...rest } = playlist;
  const coverThumbnails: string[] = [];

  for (const pair of ugcPairs) {
    const url = pair.map?.thumbnailUrl;
    if (url && !coverThumbnails.includes(url)) {
      coverThumbnails.push(url);
      if (coverThumbnails.length >= COVER_THUMBNAIL_LIMIT) break;
    }
  }

  return { ...rest, coverThumbnails };
}
