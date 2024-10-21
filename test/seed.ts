import { lucia } from "../src/lucia";
import prisma from "../src/prisma";
import { assets, contributors, playlists, tags, users } from "./seeds/seedData";

export async function seedDatabase() {
  await prisma.user.createMany({
    data: users,
  });

  await prisma.tag.createMany({
    data: tags,
  });

  await prisma.contributor.createMany({
    data: contributors,
  });

  await prisma.ugc.createMany({
    data: assets.map(({ tags, contributors, ...rest }) => rest),
  });

  for (const asset of assets) {
    await prisma.ugc.update({
      where: { assetId: asset.assetId },
      data: {
        contributors: {
          connect: asset.contributors.map((contributor) => {
            return { xuid: contributor.xuid };
          }), // replace 'season-id' with the actual season ID
        },
        tag: {
          connect: asset.tags.map((tag: string) => {
            return { name: tag };
          }),
        },
      },
    });
  }
  await prisma.playlist.createMany({
    data: playlists,
  });
  let i = 0;
  for (const playlist of playlists) {
    await prisma.playlist.update({
      where: { assetId: playlist.assetId },
      data: {
        ugc: {
          connect: assets.slice(i).map((asset) => ({ assetId: asset.assetId })),
        },
      },
    });
    i++;
  }
}

export async function resetDatabase() {
  const deleteAssets = prisma.$executeRawUnsafe("DELETE FROM Ugc");
  const deleteTags = prisma.tag.deleteMany({});
  const deleteContributors = prisma.contributor.deleteMany();
  const deletePlaylists = prisma.playlist.deleteMany();
  const deleteUsers = prisma.user.deleteMany();

  await prisma.$transaction([
    deleteAssets,
    deleteTags,
    deleteContributors,
    deleteUsers,
    deletePlaylists,
  ]);
  await prisma.$disconnect();
}

export async function getUserSession() {
  const session = await lucia.createSession("d9st0aohdnch56c", {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  return { session: session, sessionCookie: sessionCookie };
}

function createFile(
  name: string,
  type: string,
  content: string | Buffer,
): File {
  return new File([content], name, { type });
}

// Create a PNG image File
const pngImageContent = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==",
  "base64",
);
export const imageFile = createFile(
  "test-image.png",
  "image/png",
  pngImageContent,
);

// Create a non-image File (text file in this case)
const textFileContent = "This is a test text file.";
export const textFile = createFile(
  "test-file.txt",
  "text/plain",
  textFileContent,
);
