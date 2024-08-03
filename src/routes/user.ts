import Elysia from "elysia";
import { authApp } from "../middleware";
import { prisma } from "../prisma";
export const user = new Elysia().use(authApp).get("/user", async (context) => {
  if (!context.user) {
    return new Response(null, {
      status: 401,
    });
  }
  const user = await prisma.user.findUnique({
    where: {
      id: context.user.id,
    },
    include: {
      Playlist: {
        select: {
          assetId: true,
          name: true,
        },
      },
    },
  });
  return user;
});
