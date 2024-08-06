import { Elysia, t } from "elysia";
import { authApp } from "../middleware";
import { prisma } from "../prisma";

export const favorites = new Elysia().group("/favorites", (app) => {
  return app
    .use(authApp)
    .get("/", async ({ user, session }) => {
      if (!user || !session) {
        return new Response(null, {
          status: 401,
        });
      }
      let favorites = await prisma.user.findUnique({
        where: {
          id: user.id,
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
      if (!favorites) {
        return new Response(null, {
          status: 404,
        });
      }
      return favorites;
    })
    .post(
      "/:assetId",
      async ({ user, session, params: { assetId } }) => {
        if (!user || !session) {
          return new Response(null, {
            status: 401,
          });
        }
        let playlist = await prisma.playlist.findUnique({
          where: {
            assetId: assetId,
          },
        });
        if (!playlist) {
          return new Response(null, {
            status: 404,
          });
        }
        if (playlist.private && playlist.userId !== user.id) {
          return new Response(null, {
            status: 403,
          });
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
          return new Response(null, {
            status: 401,
          });
        }
        let playlist = await prisma.playlist.findUnique({
          where: {
            assetId: assetId,
          },
        });
        if (!playlist) {
          return new Response(null, {
            status: 404,
          });
        }
        if (playlist.private && playlist.userId !== user.id) {
          return new Response(null, {
            status: 403,
          });
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
