import { Elysia, t } from "elysia";
import { authApp } from "../middleware";
import prisma from "../prisma";
import {
  Forbidden,
  NotFound,
  TooManyRequests,
  Unauthorized,
} from "../lib/errors";
import { rateLimit } from "elysia-rate-limit";
import { cloudflareGenerator } from "../lib/rateLimit";
import { server } from "..";

export const favorites = new Elysia()
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
  .group("/favorites", (app) => {
    return app
      .use(authApp)
      .post(
        "/:assetId",
        async ({ user, session, params: { assetId } }) => {
          if (!user || !session) {
            throw new Unauthorized();
          }
          let playlist = await prisma.playlist.findUnique({
            where: {
              assetId: assetId,
            },
          });
          if (!playlist) {
            throw new NotFound();
          }
          if (playlist.private && playlist.userId !== user.id) {
            throw new Forbidden();
          }

          let userData = await prisma.user.update({
            where: {
              id: user.id,
            },
            data: {
              favorites: {
                connect: {
                  assetId,
                },
              },
            },
            omit: {
              oid: true,
              xuid: true,
              serviceTag: true,
              emblemPath: true,
            },

            include: {
              favorites: true,
            },
          });

          return userData;
        },
        {
          params: t.Object({
            assetId: t.String({
              format: "uuid",
            }),
          }),
        },
      )
      .delete(
        "/:assetId",
        async ({ user, session, params: { assetId } }) => {
          if (!user || !session) {
            throw new Unauthorized();
          }
          let playlist = await prisma.playlist.findUnique({
            where: {
              assetId: assetId,
            },
          });
          if (!playlist) {
            throw new NotFound();
          }
          if (playlist.private && playlist.userId !== user.id) {
            throw new Forbidden();
          }

          let userData = await prisma.user.update({
            where: {
              id: user.id,
            },
            data: {
              favorites: {
                disconnect: {
                  assetId,
                },
              },
            },
            omit: {
              oid: true,
              xuid: true,
              serviceTag: true,
              emblemPath: true,
            },
            include: {
              favorites: true,
            },
          });

          return userData;
        },
        {
          params: t.Object({
            assetId: t.String({
              format: "uuid",
            }),
          }),
        },
      );
  });
export const favorites2 = new Elysia()
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
  .group("/favorites", (app) => {
    return app.use(authApp).get(
      "/",
      async ({
        user,
        session,
        query: {
          sort = "name",
          order = "desc",
          count = 20,
          offset = 0,
          searchTerm,
          gamertag,
        },
        set,
      }) => {
        if (!user || !session) {
          throw new Unauthorized();
        }
        const whereOptions: any = {
          favoritedBy: {
            some: {
              id: user.id,
            },
          },
        };

        if (searchTerm) {
          whereOptions.name = {
            contains: searchTerm,
          };
        }
        if (gamertag) {
        } else {
          whereOptions.private = false;
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
            count: t.Numeric({
              minimum: 1,
              maximum: 30,
              default: 20,
            }),
            offset: t.Numeric({
              default: 0,
            }),
            searchTerm: t.String(),
            gamertag: t.String(),
          }),
        ),
      },
    );
  });
