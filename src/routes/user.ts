import { Elysia } from "elysia";
import { authApp } from "../middleware";
import prisma from "../prisma";
import { Unauthorized, NotFound } from "../lib/errors";
import { rateLimit } from "elysia-rate-limit";
export const user = new Elysia()
  .use(
    rateLimit({
      duration: 60000,
      max: 3,
      errorResponse: new Unauthorized(),
      scoping: "scoped",
    }),
  )
  .use(authApp)
  .get("/user", async (context) => {
    if (!context.user) {
      throw new Unauthorized();
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
    if (!user) {
      throw new NotFound();
    }
    context.set.headers["Cache-Control"] = "private, no-store, max-age=0";
    return user;
  });
