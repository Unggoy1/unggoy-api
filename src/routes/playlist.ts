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
              select: { favoritedBy: true, ugc: true },
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

          const whereOptions: any = {
            playlist: {
              some: {
                assetId: playlistId,
              },
            },
          };

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

          const [data, totalCount] = await prisma.ugc.findManyAndCount({
            where: whereOptions,

            include: {
              tag: {
                select: {
                  name: true,
                },
              },
              playlist: true,
              contributors: true,
            },
            omit: {
              files: true,
              numberOfObjects: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: {
              [sort]: order,
            },
            take: count,
            skip: offset,
          });
          const assets = data.map((asset) => {
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
          if (assetId) {
            connectOptions.ugc = {
              connect: {
                assetId: assetId,
              },
            };
          }
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
              ...connectOptions,
            },
          });

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

          playlist = await prisma.playlist.update({
            where: {
              assetId: playlistId,
            },
            data: {
              ugc: {
                connect: {
                  assetId,
                },
              },
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
          let playlist = await prisma.playlist.findUnique({
            where: {
              userId: user.id,
              assetId: playlistId,
              ugc: {
                some: {
                  assetId: assetId,
                },
              },
            },
          });
          if (!playlist) {
            throw new NotFound();
          }

          if (playlist.private && (!user || playlist.userId !== user.id)) {
            throw new Forbidden();
          }

          playlist = await prisma.playlist.update({
            where: {
              assetId: playlistId,
            },
            data: {
              ugc: {
                disconnect: {
                  assetId,
                },
              },
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
      );
  });
