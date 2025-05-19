import { Elysia, t } from "elysia";
import { authApp } from "../middleware";
import prisma from "../prisma";
import { rateLimit } from "elysia-rate-limit";
import { createHash } from "crypto";
import { Profanity, ProfanityOptions } from "@2toad/profanity";
import {
  Duplicate,
  Forbidden,
  NotFound,
  TooManyRequests,
  Unauthorized,
  Unknown,
  Validation,
} from "../lib/errors";
import {
  checkImageNsfw,
  deleteFromS3,
  extractS3Key,
  generateUniqueFilename,
  resizeAndOptimizeFileToWebP,
  updateS3File,
  uploadToS3,
} from "../lib/imageTools";
import { cloudflareGenerator } from "../lib/rateLimit";
import { server } from "..";
import { validateInput } from "../lib/textTools";
function computeETag(updatedAt: Date): string {
  // Use updatedAt as the basis for the ETag
  return createHash("md5").update(updatedAt.toISOString()).digest("hex");
}

const profanity = new Profanity({
  languages: ["de", "en", "es", "fr"],
  wholeWord: true,
  grawlix: "****",
  grawlixChar: "*",
});
profanity.removeWords([
  "butt",
  "arse",
  "bollok",
  "fanny",
  "poop",
  "screwing",
  "turd",
  "sadist",
  "rectum",
  "balls",
  "bloody",
  "bollock",
  "bollok",
  "bugger",
  "damn",
  "bum",
  "cox",
  "crap",
  "flange",
  "homo",
  "pawn",
  "pecker",
  "spunk",
  "willy",
]);

export const playlists = new Elysia()
  .use(
    rateLimit({
      scoping: "scoped",
      errorResponse: new TooManyRequests(),
      max: 100,
      generator: cloudflareGenerator,
      injectServer: () => {
        return server!;
      },
    }),
  )
  .group("/playlist", (app) => {
    return app
      .use(authApp)
      .get(
        "/:playlistId",
        async ({
          user,
          session,
          set,
          params: { playlistId },
          query: {
            assetKind,
            sort = "publishedAt",
            order = "desc",
            count = 20,
            offset = 0,
            tags,
            searchTerm,
            gamertag,
            ownerOnly,
          },
        }) => {
          let includeOptions: any = {
            _count: {
              select: { favoritedBy: true, ugcPairs: true },
            },
            user: {
              select: {
                username: true,
                emblemPath: true,
              },
            },
          };
          if (user && session) {
            includeOptions.favoritedBy = {
              where: {
                id: user.id,
              },
              select: {
                id: true,
                username: true,
              },
            };
          }
          let playlist = await prisma.playlist.findUnique({
            where: {
              assetId: playlistId,
            },
            include: includeOptions,
          });

          if (!playlist) {
            throw new NotFound();
          }

          if (playlist.private && (!user || playlist.userId !== user.id)) {
            throw new Forbidden();
          }

          const whereOptions: any = {};

          if (searchTerm) {
            whereOptions.name = {
              contains: searchTerm,
            };
          }
          if (assetKind) {
            whereOptions.assetKind = assetKind;
          }
          if (tags) {
            whereOptions.tag = {
              some: {
                name: {
                  in: [tags],
                },
              },
            };
          }
          if (gamertag) {
            if (ownerOnly) {
              whereOptions.author = {
                is: {
                  gamertag: gamertag,
                },
              };
            } else {
              whereOptions.contributors = {
                some: {
                  gamertag: gamertag,
                },
              };
            }
          }

          // Get UgcPairs with their related maps and gamemodes
          const ugcPairs = await prisma.ugcPair.findMany({
            where: {
              playlistId: playlistId,
            },
            include: {
              map: {
                include: {
                  tag: {
                    select: {
                      name: true,
                    },
                  },
                  contributors: true,
                },
                omit: {
                  files: true,
                  numberOfObjects: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
              gamemode: {
                include: {
                  tag: {
                    select: {
                      name: true,
                    },
                  },
                  contributors: true,
                },
                omit: {
                  files: true,
                  numberOfObjects: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
          });

          // Combine maps and gamemodes into a single array
          const allUgcAssets = [];
          const assetIds = new Set();
          
          ugcPairs.forEach(pair => {
            if (pair.map && !assetIds.has(pair.map.assetId)) {
              assetIds.add(pair.map.assetId);
              allUgcAssets.push(pair.map);
            }
            if (pair.gamemode && !assetIds.has(pair.gamemode.assetId)) {
              assetIds.add(pair.gamemode.assetId);
              allUgcAssets.push(pair.gamemode);
            }
          });

          // Apply filters
          let filteredAssets = allUgcAssets;
          
          if (searchTerm) {
            filteredAssets = filteredAssets.filter(asset => 
              asset.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
          }
          
          if (assetKind) {
            filteredAssets = filteredAssets.filter(asset => asset.assetKind === assetKind);
          }
          
          if (tags) {
            filteredAssets = filteredAssets.filter(asset => 
              asset.tag.some(t => t.name === tags)
            );
          }
          
          if (gamertag) {
            if (ownerOnly) {
              filteredAssets = filteredAssets.filter(asset => 
                asset.author?.gamertag === gamertag
              );
            } else {
              filteredAssets = filteredAssets.filter(asset => 
                asset.contributors.some(c => c.gamertag === gamertag)
              );
            }
          }

          // Apply sorting
          filteredAssets.sort((a, b) => {
            const aValue = a[sort];
            const bValue = b[sort];
            
            if (order === 'asc') {
              return aValue > bValue ? 1 : -1;
            } else {
              return aValue < bValue ? 1 : -1;
            }
          });

          // Apply pagination
          const totalCount = filteredAssets.length;
          const paginatedAssets = filteredAssets.slice(offset, offset + count);
          const assets = paginatedAssets.map((asset) => {
            return {
              ...asset,
              tags: asset.tag.map((t) => t.name),
              tag: undefined,
            };
          });
          if (playlist.private) {
            set.headers["Cache-Control"] = "private, no-store, max-age=0";
          } else {
            // set.headers["Cache-Control"] =
            //   "public, max-age=300, stale-while-revalidate=600";
            // set.headers["ETag"] = computeETag(playlist.updatedAt);
            // set.headers["Last-Modified"] = playlist.updatedAt.toUTCString();
          }
          return {
            totalCount: totalCount,
            pageSize: count,
            assets: assets,
            playlist: playlist,
          };
        },
        {
          params: t.Object({
            playlistId: t.String({
              format: "uuid",
            }),
          }),
          query: t.Partial(
            t.Object({
              assetKind: t.Number(),
              sort: t.Union(
                [
                  t.Literal("publishedAt"),
                  t.Literal("name"),
                  t.Literal("averageRating"),
                  t.Literal("bookmarks"),
                  t.Literal("playsRecent"),
                  t.Literal("playsAllTime"),
                ],
                {
                  default: "publishedAt",
                },
              ),
              order: t.Union([t.Literal("desc"), t.Literal("asc")], {
                default: "desc",
              }),
              count: t.Number({
                minimum: 1,
                maximum: 30,
                default: 20,
              }),
              offset: t.Number({
                default: 0,
              }),
              tags: t.String(),
              searchTerm: t.String(),
              gamertag: t.String(),
              ownerOnly: t.BooleanString(),
            }),
          ),
        },
      )
      .delete(
        "/:playlistId",
        async ({ user, session, params: { playlistId } }) => {
          if (!user || !session) {
            throw new Unauthorized();
          }

          const playlist = await prisma.playlist.findUnique({
            where: {
              assetId: playlistId,
            },
          });
          if (!playlist) {
            throw new NotFound();
          }
          if (playlist.userId !== user.id) {
            throw new Forbidden();
          }

          try {
            await prisma.playlist.delete({
              where: { assetId: playlistId },
            });
            const thumbnailKey = extractS3Key(playlist.thumbnailUrl);
            if (thumbnailKey) {
              await deleteFromS3(process.env.S3_BUCKET_NAME, thumbnailKey);
            }
          } catch (error) {
            throw new Unknown();
          }

          return;
        },
        {
          params: t.Object({
            playlistId: t.String({
              format: "uuid",
            }),
          }),
        },
      )
      .get(
        "/browse",
        async ({
          set,
          query: {
            sort = "updatedAt",
            order = "desc",
            count = 20,
            offset = 0,
            searchTerm,
            gamertag,
          },
        }) => {
          const whereOptions: any = {
            private: false,
          };

          if (searchTerm) {
            whereOptions.name = {
              contains: searchTerm,
            };
          }
          if (gamertag) {
            whereOptions.user = {
              username: gamertag,
            };
          }
          const sortOptions: any =
            sort === "favorites"
              ? { favoritedBy: { _count: "desc" } }
              : { [sort]: order };

          const [data, totalCount] = await prisma.playlist.findManyAndCount({
            where: whereOptions,

            orderBy: sortOptions,
            take: count,
            skip: offset,
          });

          // set.headers["Cache-Control"] =
          //   "public, max-age=300, stale-while-revalidate=600";
          return { totalCount: totalCount, pageSize: count, assets: data };
        },
        {
          query: t.Partial(
            t.Object({
              sort: t.Union(
                [
                  t.Literal("updatedAt"),
                  t.Literal("name"),
                  t.Literal("favorites"),
                ],
                {
                  default: "updatedAt",
                },
              ),
              order: t.Union([t.Literal("desc"), t.Literal("asc")], {
                default: "desc",
              }),
              count: t.Number({
                minimum: 1,
                maximum: 30,
                default: 20,
              }),
              offset: t.Number({
                default: 0,
              }),
              searchTerm: t.String(),
              gamertag: t.String(),
            }),
          ),
        },
      )
      .get(
        "/me",
        async ({
          user,
          session,
          set,
          query: {
            sort = "name",
            order = "desc",
            count = 20,
            offset = 0,
            searchTerm,
          },
        }) => {
          if (!user || !session) {
            throw new Unauthorized();
          }

          const whereOptions: any = {
            userId: user.id,
          };

          if (searchTerm) {
            whereOptions.name = {
              contains: searchTerm,
            };
          }
          const sortOptions: any =
            sort === "favorites"
              ? { favoritedBy: { _count: "desc" } }
              : { [sort]: order };

          const [data, totalCount] = await prisma.playlist.findManyAndCount({
            where: whereOptions,

            orderBy: sortOptions,
            take: count,
            skip: offset,
          });

          set.headers["Cache-Control"] = "private, no-store, max-age=0";
          return { totalCount: totalCount, pageSize: count, assets: data };
        },
        {
          query: t.Partial(
            t.Object({
              sort: t.Union(
                [
                  t.Literal("updatedAt"),
                  t.Literal("name"),
                  t.Literal("favorites"),
                ],
                {
                  default: "updatedAt",
                },
              ),
              order: t.Union([t.Literal("desc"), t.Literal("asc")], {
                default: "desc",
              }),
              count: t.Number({
                minimum: 1,
                maximum: 30,
                default: 20,
              }),
              offset: t.Number({
                default: 0,
              }),
              searchTerm: t.String(),
            }),
          ),
        },
      );
  });

export const playlists2 = new Elysia()
  .use(
    rateLimit({
      scoping: "scoped",
      errorResponse: new TooManyRequests(),
      max: 10,
      duration: 1800000,
      generator: cloudflareGenerator,
      injectServer: () => {
        return server!;
      },
    }),
  )
  .group("/playlist", (app) => {
    return app
      .use(authApp)
      .post(
        "/",
        async ({
          user,
          session,
          body: { name, description, isPrivate = false, thumbnail, assetId },
          request: { headers },
        }) => {
          if (!user || !session) {
            throw new Unauthorized();
          }
          const nameValidation = validateInput(name, 4);
          const descValidation = validateInput(description, 10);
          if (!nameValidation.isValid || !descValidation.isValid) {
            const message = !nameValidation.isValid
              ? "Expected name to be greater than 4"
              : "Expected description to be greater than 10";
            throw new Validation(message);
          }
          name = profanity.censor(nameValidation.sanitized);
          description = profanity.censor(descValidation.sanitized);

          // Check if user has reached playlist limit
          const playlistCount = await prisma.playlist.count({
            where: { userId: user.id },
          });

          if (playlistCount >= 50) {
            throw new Forbidden();
          }

          let playlist = await prisma.playlist.findFirst({
            where: {
              userId: user.id,
              name: name,
            },
          });
          if (playlist) {
            throw new Duplicate();
          }

          const connectOptions: any = {};
          // We'll handle ugcPairs separately after creating the playlist
          let fileName;
          if (thumbnail) {
            const isImageNSFW = await checkImageNsfw(thumbnail);
            if (isImageNSFW) {
              throw new Validation();
            }
            const webpImage = await resizeAndOptimizeFileToWebP(
              thumbnail,
              560,
              320,
            );
            fileName = generateUniqueFilename(user.id);
            await uploadToS3(webpImage, process.env.S3_BUCKET_NAME, fileName);
          }

          playlist = await prisma.playlist.create({
            data: {
              name: name,
              description: description,
              private: isPrivate,
              thumbnailUrl: fileName
                ? `${process.env.IMAGE_DOMAIN}${fileName}`
                : "/placeholder.webp",
              userId: user.id,
            },
          });

          // If an assetId is provided, create a UgcPair for it
          if (assetId) {
            const asset = await prisma.ugc.findUnique({
              where: { assetId: assetId },
            });
            
            if (asset) {
              await prisma.ugcPair.create({
                data: {
                  playlistId: playlist.assetId,
                  mapAssetId: asset.assetKind === 2 ? assetId : null,
                  gamemodeAssetId: asset.assetKind === 6 ? assetId : null,
                },
              });
            }
          }

          return playlist;
        },
        {
          body: t.Object({
            name: t.String({
              maxLength: 255,
              minLength: 3,
            }),
            description: t.String({
              maxLength: 255,
              minLength: 10,
            }),
            isPrivate: t.Optional(t.BooleanString({ default: false })),
            thumbnail: t.Optional(
              t.File({
                type: "image",
                maxSize: "1m",
              }),
            ),
            assetId: t.Optional(
              t.String({
                format: "uuid",
              }),
            ),
          }),
        },
      )
      .put(
        "/:playlistId/",
        async ({
          user,
          session,
          params: { playlistId },
          body: { name, description, isPrivate, thumbnail },
        }) => {
          if (!user || !session) {
            throw new Unauthorized();
          }
          if (!name && !description && isPrivate === undefined && !thumbnail) {
            throw new Validation();
          }

          if (name !== undefined) {
            const nameValidation = validateInput(name, 4);
            if (!nameValidation.isValid) {
              const message = "Expected name to be greater than 4";
              throw new Validation(message);
            }
            name = profanity.censor(nameValidation.sanitized);
          }
          if (description !== undefined) {
            const descValidation = validateInput(description, 10);
            if (!descValidation.isValid) {
              const message = "Expected description to be greater than 10";
              throw new Validation(message);
            }
            description = profanity.censor(descValidation.sanitized);
          }

          let playlist = await prisma.playlist.findUnique({
            where: {
              assetId: playlistId,
            },
          });
          if (!playlist) {
            throw new NotFound();
          }
          if (playlist.userId !== user.id) {
            throw new Forbidden();
          }

          if (name) {
            const existingPlaylist = await prisma.playlist.findFirst({
              where: {
                userId: user.id,
                name: name,
              },
            });
            if (existingPlaylist) {
              throw new Duplicate();
            }
          }
          try {
            const updateData: {
              name?: string;
              description?: string;
              private?: boolean;
              thumbnailUrl?: string;
            } = {
              name: name,
              description: description,
              private: isPrivate,
            };

            let fileName;
            if (thumbnail) {
              const isImageNSFW = await checkImageNsfw(thumbnail);
              if (isImageNSFW) {
                throw new Validation();
              }
              const webpImage = await resizeAndOptimizeFileToWebP(
                thumbnail,
                560,
                320,
              );
              fileName = generateUniqueFilename(user.id);
              await updateS3File(
                webpImage,
                process.env.S3_BUCKET_NAME,
                fileName,
                playlist.thumbnailUrl,
              );
              updateData.thumbnailUrl = `${process.env.IMAGE_DOMAIN}${fileName}`;
            }

            playlist = await prisma.playlist.update({
              where: { assetId: playlistId },
              data: { ...updateData },
            });

            return playlist;
          } catch (error) {
            console.log(error);
            throw new Unknown();
          }
        },
        {
          params: t.Object({
            playlistId: t.String({
              format: "uuid",
            }),
          }),
          body: t.Partial(
            t.Object({
              name: t.String({
                maxLength: 255,
                minLength: 4,
              }),
              description: t.String({
                maxLength: 255,
                minLength: 10,
              }),
              isPrivate: t.BooleanString(),
              thumbnail: t.File({
                type: "image",
                maxSize: "1m",
              }),
            }),
          ),
        },
      );
  });

export const playlists3 = new Elysia()
  .use(
    rateLimit({
      scoping: "scoped",
      errorResponse: new TooManyRequests(),
      max: 50,
      generator: cloudflareGenerator,
      injectServer: () => {
        return server!;
      },
    }),
  )
  .group("/playlist", (app) => {
    return app
      .use(authApp)
      .post(
        "/:playlistId/asset/:assetId",
        async ({ user, session, params: { playlistId, assetId } }) => {
          if (!user || !session) {
            throw new Unauthorized();
          }
          let playlist = await prisma.playlist.findUnique({
            where: {
              userId: user.id,
              assetId: playlistId,
            },
          });

          let asset = await prisma.ugc.findUnique({
            where: {
              assetId: assetId,
            },
          });
          if (!playlist || !asset) {
            throw new NotFound();
          }

          if (playlist.private) {
            if (!user) {
              throw new Unauthorized();
            }
            if (playlist.userId !== user.id) {
              throw new Forbidden();
            }
          }

          // Check if this UGC is already in the playlist
          const existingPair = await prisma.ugcPair.findFirst({
            where: {
              playlistId: playlistId,
              OR: [
                { mapAssetId: assetId },
                { gamemodeAssetId: assetId },
              ],
            },
          });

          if (existingPair) {
            throw new Duplicate();
          }

          // Create a new UgcPair
          await prisma.ugcPair.create({
            data: {
              playlistId: playlistId,
              mapAssetId: asset.assetKind === 2 ? assetId : null,
              gamemodeAssetId: asset.assetKind === 6 ? assetId : null,
            },
          });

          // Update playlist's updatedAt timestamp
          playlist = await prisma.playlist.update({
            where: {
              assetId: playlistId,
            },
            data: {
              updatedAt: new Date(),
            },
          });

          return playlist;
        },
        {
          params: t.Object({
            playlistId: t.String({
              format: "uuid",
            }),
            assetId: t.String({
              format: "uuid",
            }),
          }),
        },
      )
      .delete(
        "/:playlistId/asset/:assetId",
        async ({ user, session, params: { playlistId, assetId } }) => {
          if (!user || !session) {
            throw new Unauthorized();
          }
          // Find the playlist
          let playlist = await prisma.playlist.findUnique({
            where: {
              userId: user.id,
              assetId: playlistId,
            },
          });
          
          if (!playlist) {
            throw new NotFound();
          }

          if (playlist.private && (!user || playlist.userId !== user.id)) {
            throw new Forbidden();
          }

          // Find the UgcPair to delete
          const ugcPair = await prisma.ugcPair.findFirst({
            where: {
              playlistId: playlistId,
              OR: [
                { mapAssetId: assetId },
                { gamemodeAssetId: assetId },
              ],
            },
          });

          if (!ugcPair) {
            throw new NotFound();
          }

          // Delete the UgcPair
          await prisma.ugcPair.delete({
            where: {
              id: ugcPair.id,
            },
          });

          // Update playlist's updatedAt timestamp
          playlist = await prisma.playlist.update({
            where: {
              assetId: playlistId,
            },
            data: {
              updatedAt: new Date(),
            },
          });

          return playlist;
        },
        {
          params: t.Object({
            playlistId: t.String({
              format: "uuid",
            }),
            assetId: t.String({
              format: "uuid",
            }),
          }),
        },
      )
      .get(
        "/:playlistId/pairs",
        async ({ 
          user, 
          session, 
          params: { playlistId },
          query: {
            assetKind,
            sort = "createdAt",
            order = "desc",
            count = 20,
            offset = 0,
            tags,
            searchTerm,
            gamertag,
            ownerOnly,
          }
        }) => {
          // Get the playlist
          const playlist = await prisma.playlist.findUnique({
            where: {
              assetId: playlistId,
            },
          });

          if (!playlist) {
            throw new NotFound();
          }

          // Check access permissions
          if (playlist.private) {
            if (!user || !session) {
              throw new Unauthorized();
            }
            if (playlist.userId !== user.id) {
              throw new Forbidden();
            }
          }

          // Get all UgcPairs for this playlist
          const ugcPairs = await prisma.ugcPair.findMany({
            where: {
              playlistId: playlistId,
            },
            include: {
              map: {
                include: {
                  tag: {
                    select: {
                      name: true,
                    },
                  },
                  contributors: true,
                  author: true,
                },
                omit: {
                  files: true,
                  numberOfObjects: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
              gamemode: {
                include: {
                  tag: {
                    select: {
                      name: true,
                    },
                  },
                  contributors: true,
                  author: true,
                },
                omit: {
                  files: true,
                  numberOfObjects: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
          });

          // Transform and filter the data
          let pairs = ugcPairs.map(pair => ({
            id: pair.id,
            map: pair.map ? {
              ...pair.map,
              tags: pair.map.tag.map(t => t.name),
              tag: undefined,
            } : null,
            gamemode: pair.gamemode ? {
              ...pair.gamemode,
              tags: pair.gamemode.tag.map(t => t.name),
              tag: undefined,
            } : null,
            createdAt: pair.createdAt,
          }));

          // Apply filters
          if (assetKind) {
            pairs = pairs.filter(pair => {
              if (assetKind === 2) return pair.map !== null;
              if (assetKind === 6) return pair.gamemode !== null;
              return false;
            });
          }

          if (searchTerm) {
            pairs = pairs.filter(pair => {
              const mapMatch = pair.map?.name.toLowerCase().includes(searchTerm.toLowerCase());
              const gamemodeMatch = pair.gamemode?.name.toLowerCase().includes(searchTerm.toLowerCase());
              return mapMatch || gamemodeMatch;
            });
          }

          if (tags) {
            pairs = pairs.filter(pair => {
              const mapHasTag = pair.map?.tags.includes(tags);
              const gamemodeHasTag = pair.gamemode?.tags.includes(tags);
              return mapHasTag || gamemodeHasTag;
            });
          }

          if (gamertag) {
            pairs = pairs.filter(pair => {
              if (ownerOnly) {
                const mapOwnerMatch = pair.map?.author?.gamertag === gamertag;
                const gamemodeOwnerMatch = pair.gamemode?.author?.gamertag === gamertag;
                return mapOwnerMatch || gamemodeOwnerMatch;
              } else {
                const mapContributorMatch = pair.map?.contributors.some(c => c.gamertag === gamertag);
                const gamemodeContributorMatch = pair.gamemode?.contributors.some(c => c.gamertag === gamertag);
                return mapContributorMatch || gamemodeContributorMatch;
              }
            });
          }

          // Apply sorting
          const sortField = sort === 'createdAt' ? 'createdAt' : null;
          
          if (sortField) {
            pairs.sort((a, b) => {
              const aValue = a[sortField];
              const bValue = b[sortField];
              
              if (order === 'asc') {
                return aValue > bValue ? 1 : -1;
              } else {
                return aValue < bValue ? 1 : -1;
              }
            });
          } else {
            // For asset fields, we need to handle both map and gamemode
            pairs.sort((a, b) => {
              let aValue = a.map?.[sort] || a.gamemode?.[sort];
              let bValue = b.map?.[sort] || b.gamemode?.[sort];
              
              // If one pair has both map and gamemode, prioritize based on assetKind filter
              if (a.map && a.gamemode && assetKind) {
                aValue = assetKind === 2 ? a.map[sort] : a.gamemode[sort];
              }
              if (b.map && b.gamemode && assetKind) {
                bValue = assetKind === 2 ? b.map[sort] : b.gamemode[sort];
              }
              
              // Handle null values
              if (aValue === null || aValue === undefined) return 1;
              if (bValue === null || bValue === undefined) return -1;
              
              if (order === 'asc') {
                return aValue > bValue ? 1 : -1;
              } else {
                return aValue < bValue ? 1 : -1;
              }
            });
          }

          // Apply pagination
          const totalCount = pairs.length;
          const paginatedPairs = pairs.slice(offset, offset + count);

          return {
            playlistId: playlistId,
            pairs: paginatedPairs,
            totalCount: totalCount,
            pageSize: count,
          };
        },
        {
          params: t.Object({
            playlistId: t.String({
              format: "uuid",
            }),
          }),
          query: t.Partial(
            t.Object({
              assetKind: t.Number(),
              sort: t.Union(
                [
                  t.Literal("createdAt"),
                  t.Literal("publishedAt"),
                  t.Literal("name"),
                  t.Literal("averageRating"),
                  t.Literal("bookmarks"),
                  t.Literal("playsRecent"),
                  t.Literal("playsAllTime"),
                ],
                {
                  default: "createdAt",
                },
              ),
              order: t.Union([t.Literal("desc"), t.Literal("asc")], {
                default: "desc",
              }),
              count: t.Number({
                minimum: 1,
                maximum: 30,
                default: 20,
              }),
              offset: t.Number({
                default: 0,
              }),
              tags: t.String(),
              searchTerm: t.String(),
              gamertag: t.String(),
              ownerOnly: t.BooleanString(),
            }),
          ),
        },
      )
      .post(
        "/:playlistId/pair",
        async ({ user, session, params: { playlistId }, body: { mapAssetId, gamemodeAssetId } }) => {
          if (!user || !session) {
            throw new Unauthorized();
          }
          
          // Verify playlist exists and user has access
          let playlist = await prisma.playlist.findUnique({
            where: {
              userId: user.id,
              assetId: playlistId,
            },
          });

          if (!playlist) {
            throw new NotFound();
          }

          // Verify the assets exist and are of correct types
          const mapAsset = mapAssetId ? await prisma.ugc.findUnique({
            where: { assetId: mapAssetId },
          }) : null;
          
          const gamemodeAsset = gamemodeAssetId ? await prisma.ugc.findUnique({
            where: { assetId: gamemodeAssetId },
          }) : null;

          if (mapAssetId && (!mapAsset || mapAsset.assetKind !== 2)) {
            throw new Validation("Invalid map asset");
          }
          
          if (gamemodeAssetId && (!gamemodeAsset || gamemodeAsset.assetKind !== 6)) {
            throw new Validation("Invalid gamemode asset");
          }

          if (!mapAssetId && !gamemodeAssetId) {
            throw new Validation("At least one asset ID must be provided");
          }

          // Check if this pair already exists
          const existingPair = await prisma.ugcPair.findFirst({
            where: {
              playlistId: playlistId,
              mapAssetId: mapAssetId || null,
              gamemodeAssetId: gamemodeAssetId || null,
            },
          });

          if (existingPair) {
            throw new Duplicate();
          }

          // Create the new UgcPair
          const ugcPair = await prisma.ugcPair.create({
            data: {
              playlistId: playlistId,
              mapAssetId: mapAssetId || null,
              gamemodeAssetId: gamemodeAssetId || null,
            },
          });

          // Update playlist's updatedAt timestamp
          await prisma.playlist.update({
            where: {
              assetId: playlistId,
            },
            data: {
              updatedAt: new Date(),
            },
          });

          return ugcPair;
        },
        {
          params: t.Object({
            playlistId: t.String({
              format: "uuid",
            }),
          }),
          body: t.Object({
            mapAssetId: t.Optional(t.String({
              format: "uuid",
            })),
            gamemodeAssetId: t.Optional(t.String({
              format: "uuid",
            })),
          }),
        },
      )
      .put(
        "/:playlistId/pair/:pairId",
        async ({ user, session, params: { playlistId, pairId }, body: { mapAssetId, gamemodeAssetId } }) => {
          if (!user || !session) {
            throw new Unauthorized();
          }

          // Verify playlist exists and user has access
          const playlist = await prisma.playlist.findUnique({
            where: {
              userId: user.id,
              assetId: playlistId,
            },
          });

          if (!playlist) {
            throw new NotFound();
          }

          // Find the existing pair
          const existingPair = await prisma.ugcPair.findUnique({
            where: {
              id: pairId,
            },
          });

          if (!existingPair || existingPair.playlistId !== playlistId) {
            throw new NotFound();
          }

          // Validate we're only adding what's missing
          if (mapAssetId && existingPair.mapAssetId) {
            throw new Validation("Pair already has a map");
          }
          
          if (gamemodeAssetId && existingPair.gamemodeAssetId) {
            throw new Validation("Pair already has a gamemode");
          }

          if (!mapAssetId && !gamemodeAssetId) {
            throw new Validation("No asset ID provided to add");
          }

          // Verify the assets exist and are of correct types
          if (mapAssetId) {
            const mapAsset = await prisma.ugc.findUnique({
              where: { assetId: mapAssetId },
            });
            
            if (!mapAsset || mapAsset.assetKind !== 2) {
              throw new Validation("Invalid map asset");
            }
          }
          
          if (gamemodeAssetId) {
            const gamemodeAsset = await prisma.ugc.findUnique({
              where: { assetId: gamemodeAssetId },
            });
            
            if (!gamemodeAsset || gamemodeAsset.assetKind !== 6) {
              throw new Validation("Invalid gamemode asset");
            }
          }

          // Build the new pair data
          const newMapId = mapAssetId || existingPair.mapAssetId;
          const newGamemodeId = gamemodeAssetId || existingPair.gamemodeAssetId;

          // Check if this exact pair already exists in the playlist
          const duplicatePair = await prisma.ugcPair.findFirst({
            where: {
              playlistId: playlistId,
              mapAssetId: newMapId,
              gamemodeAssetId: newGamemodeId,
              NOT: {
                id: pairId,
              },
            },
          });

          if (duplicatePair) {
            throw new Duplicate("This exact pair already exists in the playlist");
          }

          // Update the pair
          const updatedPair = await prisma.ugcPair.update({
            where: {
              id: pairId,
            },
            data: {
              mapAssetId: newMapId,
              gamemodeAssetId: newGamemodeId,
            },
          });

          // Update playlist's updatedAt timestamp
          await prisma.playlist.update({
            where: {
              assetId: playlistId,
            },
            data: {
              updatedAt: new Date(),
            },
          });

          return updatedPair;
        },
        {
          params: t.Object({
            playlistId: t.String({
              format: "uuid",
            }),
            pairId: t.String({
              format: "uuid",
            }),
          }),
          body: t.Object({
            mapAssetId: t.Optional(t.String({
              format: "uuid",
            })),
            gamemodeAssetId: t.Optional(t.String({
              format: "uuid",
            })),
          }),
        },
      )
      .delete(
        "/:playlistId/pair/:pairId",
        async ({ user, session, params: { playlistId, pairId } }) => {
          if (!user || !session) {
            throw new Unauthorized();
          }

          // Find the playlist
          const playlist = await prisma.playlist.findUnique({
            where: {
              userId: user.id,
              assetId: playlistId,
            },
          });
          
          if (!playlist) {
            throw new NotFound();
          }

          // Find the UgcPair to delete
          const ugcPair = await prisma.ugcPair.findFirst({
            where: {
              id: pairId,
              playlistId: playlistId,
            },
          });

          if (!ugcPair) {
            throw new NotFound();
          }

          // Delete the UgcPair
          await prisma.ugcPair.delete({
            where: {
              id: pairId,
            },
          });

          // Update playlist's updatedAt timestamp
          await prisma.playlist.update({
            where: {
              assetId: playlistId,
            },
            data: {
              updatedAt: new Date(),
            },
          });

          return;
        },
        {
          params: t.Object({
            playlistId: t.String({
              format: "uuid",
            }),
            pairId: t.String({
              format: "uuid",
            }),
          }),
        },
      );
  });
