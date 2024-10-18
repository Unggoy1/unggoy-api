import { Elysia } from "elysia";
import { authApp } from "../middleware";
import prisma from "../prisma";
import {
  Unauthorized,
  NotFound,
  TooManyRequests,
  Forbidden,
  Unknown,
} from "../lib/errors";
import { rateLimit } from "elysia-rate-limit";
import { deleteFromS3, extractS3Key } from "../lib/imageTools";
export const user = new Elysia()
  .use(
    rateLimit({
      scoping: "scoped",
      errorResponse: new TooManyRequests(),
      max: 5000,
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
  })
  .delete("/user", async (context) => {
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
            thumbnailUrl: true,
          },
        },
      },
    });
    if (!user) {
      throw new NotFound();
    }
    if (context.user.id !== user.id) {
      throw new Forbidden();
    }
    try {
      await prisma.user.delete({
        where: { id: user.id },
      });

      const deletePromises = user.Playlist.map((playlist) => {
        const thumbnailKey = extractS3Key(playlist.thumbnailUrl);
        if (thumbnailKey) {
          return deleteFromS3(process.env.S3_BUCKET_NAME, thumbnailKey);
        }
        return Promise.resolve();
      });
      await Promise.all(deletePromises);
    } catch (error) {
      console.error("error deleting user");
      throw new Unknown();
    }

    return;
  });
