// test/index.test.ts
import { beforeAll, describe, expect, it, afterAll } from "bun:test";
import { app } from "../src/index";
import { treaty } from "@elysiajs/eden";
import { getUserSession, resetDatabase, seedDatabase, imageFile } from "./seed";
import { Cookie, Session } from "lucia";

let session: Session;
let sessionCookie: string;
let persistentPlaylist: any;
beforeAll(async () => {
  await seedDatabase();
  const userSession = await getUserSession();
  session = userSession.session;
  sessionCookie = userSession.sessionCookie.serialize();
});

afterAll(async () => {
  await resetDatabase();
});
const api = treaty<typeof app>(app);

describe("Playlist", async () => {
  describe("Post /playlist", () => {
    it("Can create a playlist", async () => {
      const { data, error } = await api.playlist.index.post(
        {
          name: "Unggoy Slayer",
          description: "this is a playlist for slayer maps loved by Unngoys",
          thumbnail: imageFile,
        },
        {
          headers: {
            Cookie: sessionCookie,
            Host: "localhost",
            Origin: "http://localhost",
          },
        },
      );
      expect(error).toBeNull();
      expect(data).not.toBeNull();
      persistentPlaylist = data;
    });

    it("Can create a private playlist", async () => {
      const { data, error } = await api.playlist.index.post(
        {
          name: "Private Slayer",
          description: "this is a playlist for slayer maps loved by Unngoys",
          isPrivate: true,
          thumbnail: imageFile,
        },
        {
          headers: {
            Cookie: sessionCookie,
            Host: "localhost",
            Origin: "http://localhost",
          },
        },
      );
      expect(error).toBeNull();
      expect(data).not.toBeNull();
    });

    it("Can create a playlist with default asset", async () => {
      const { data, error } = await api.playlist.index.post(
        {
          name: "last resort",
          description: "this is a playlist with last resort aka kusini bay",
          isPrivate: true,
          thumbnail: imageFile,
          assetId: "4eb7a3ac-81f7-4faa-acd8-ce6bbba667af",
        },
        {
          headers: {
            Cookie: sessionCookie,
            Host: "localhost",
            Origin: "http://localhost",
          },
        },
      );
      expect(error).toBeNull();
      expect(data).not.toBeNull();
    });

    it("Cannot create a playlist(duplicate name)", async () => {
      const { data, error } = await api.playlist.index.post(
        {
          name: "Unggoy Slayer",
          description: "this is a playlist for slayer maps loved by Unngoys",
          thumbnail: imageFile,
        },
        {
          headers: {
            Cookie: sessionCookie,
            Host: "localhost",
            Origin: "http://localhost",
          },
        },
      );

      expect(error).not.toBeNull();
      expect(error?.status).toEqual(409);
      expect(data).toBeNull();
    });

    it("Can't create a playlist(not logged in)", async () => {
      const { data, error } = await api.playlist.index.post(
        {
          name: "Unggoy Slayer",
          description: "this is a playlist for slayer maps loved by Unngoys",
          thumbnail: imageFile,
        },
        {
          headers: {
            Host: "localhost",
            Origin: "http://localhost",
          },
        },
      );

      expect(error).not.toBeNull();
      expect(error?.status).toEqual(401);
      expect(data).toBeNull();
    });
  });

  describe("Post /:playlistId/Asset/:assetId", () => {
    it("Can add an asset to a playlist", async () => {
      const { data, error } = await api
        .playlist({ playlistId: persistentPlaylist.assetId })
        .asset({ assetId: "bc753baa-f159-4f16-b3d3-ad4224a62692" })
        .post(
          {},
          {
            headers: {
              Cookie: sessionCookie,
              Host: "localhost",
              Origin: "http://localhost",
            },
          },
        );
      expect(error).toBeNull();
      expect(data).not.toBeNull();
    });

    it("Can't add asset to a playlist(not loged in)", async () => {
      const { data, error } = await api
        .playlist({ playlistId: persistentPlaylist.assetId })
        .asset({ assetId: "bc753baa-f159-4f16-b3d3-ad4224a62692" })
        .post(
          {},
          {
            headers: {
              Host: "localhost",
              Origin: "http://localhost",
            },
          },
        );
      expect(error).not.toBeNull();
      expect(error?.status).toEqual(401);
      expect(data).toBeNull();
    });

    it("Can't add asset to a playlist(user doesnt own playlist)", async () => {
      const { data, error } = await api
        .playlist({ playlistId: "00615c63-8f57-4097-97fb-2f81d7dfc1bb" })
        .asset({ assetId: "bc753baa-f159-4f16-b3d3-ad4224a62692" })
        .post(
          {},
          {
            headers: {
              Cookie: sessionCookie,
              Host: "localhost",
              Origin: "http://localhost",
            },
          },
        );
      expect(error).not.toBeNull();
      expect(error?.status).toEqual(404);
      expect(data).toBeNull();
    });

    it("Can't add asset to a playlist(invalid playlistId)", async () => {
      const { data, error } = await api
        .playlist({ playlistId: "5905451e-7652-4205-95b1-59e61ea1f889" })
        .asset({ assetId: "bc753baa-f159-4f16-b3d3-ad4224a62692" })
        .post(
          {},
          {
            headers: {
              Cookie: sessionCookie,
              Host: "localhost",
              Origin: "http://localhost",
            },
          },
        );
      expect(error).not.toBeNull();
      expect(error?.status).toEqual(404);
      expect(data).toBeNull();
    });

    it("Can't add asset to a playlist(invalid assetId)", async () => {
      const { data, error } = await api
        .playlist({ playlistId: persistentPlaylist.assetId })
        .asset({ assetId: "bc753baa-f159-4f16-b3d3-ad4224a62644" })
        .post(
          {},
          {
            headers: {
              Cookie: sessionCookie,
              Host: "localhost",
              Origin: "http://localhost",
            },
          },
        );
      expect(error).not.toBeNull();
      expect(error?.status).toEqual(404);
      expect(data).toBeNull();
    });
  });
  describe("Delete /:playlistId/Asset/:assetId", () => {
    it("Can delete an asset from a playlist", async () => {
      const { data, error } = await api
        .playlist({ playlistId: persistentPlaylist.assetId })
        .asset({ assetId: "bc753baa-f159-4f16-b3d3-ad4224a62692" })
        .delete(
          {},
          {
            headers: {
              Cookie: sessionCookie,
              Host: "localhost",
              Origin: "http://localhost",
            },
          },
        );
      expect(error).toBeNull();
      expect(data).not.toBeNull();
    });

    it("Can't delete asset from a playlist(not loged in)", async () => {
      const { data, error } = await api
        .playlist({ playlistId: persistentPlaylist.assetId })
        .asset({ assetId: "bc753baa-f159-4f16-b3d3-ad4224a62692" })
        .delete(
          {},
          {
            headers: {
              Host: "localhost",
              Origin: "http://localhost",
            },
          },
        );
      expect(error).not.toBeNull();
      expect(error?.status).toEqual(401);
      expect(data).toBeNull();
    });

    it("Can't delete asset from a playlist(user doesnt own playlist)", async () => {
      const { data, error } = await api
        .playlist({ playlistId: "00615c63-8f57-4097-97fb-2f81d7dfc1bb" })
        .asset({ assetId: "bc753baa-f159-4f16-b3d3-ad4224a62692" })
        .delete(
          {},
          {
            headers: {
              Cookie: sessionCookie,
              Host: "localhost",
              Origin: "http://localhost",
            },
          },
        );
      expect(error).not.toBeNull();
      expect(error?.status).toEqual(404);
      expect(data).toBeNull();
    });

    it("Can't delete asset from a playlist(invalid playlistId)", async () => {
      const { data, error } = await api
        .playlist({ playlistId: "5905451e-7652-4205-95b1-59e61ea1f889" })
        .asset({ assetId: "bc753baa-f159-4f16-b3d3-ad4224a62692" })
        .delete(
          {},
          {
            headers: {
              Cookie: sessionCookie,
              Host: "localhost",
              Origin: "http://localhost",
            },
          },
        );
      expect(error).not.toBeNull();
      expect(error?.status).toEqual(404);
      expect(data).toBeNull();
    });

    it("Can't delete asset from a playlist(invalid assetId)", async () => {
      const { data, error } = await api
        .playlist({ playlistId: persistentPlaylist.assetId })
        .asset({ assetId: "bc753baa-f159-4f16-b3d3-ad4224a62644" })
        .delete(
          {},
          {
            headers: {
              Cookie: sessionCookie,
              Host: "localhost",
              Origin: "http://localhost",
            },
          },
        );
      expect(error).not.toBeNull();
      expect(error?.status).toEqual(404);
      expect(data).toBeNull();
    });
  });

  describe("GET /:playlistId", () => {
    it("Can get a playlist(no auth)", async () => {
      const { data, error } = await api
        .playlist({ playlistId: persistentPlaylist.assetId })
        .get({ query: {} });

      expect(error).toBeNull();
      expect(data).not.toBeNull();
    });

    it("Can get own private playlist", async () => {
      const { data, error } = await api
        .playlist({ playlistId: "a1a513be-8146-4856-b95a-acbc8c8e5c0b" })
        .get({
          query: {},
          headers: {
            Cookie: sessionCookie,
          },
        });

      expect(error).toBeNull();
      expect(data).not.toBeNull();
    });

    it("Can't get other user private playlist(logged in)", async () => {
      const { data, error } = await api
        .playlist({ playlistId: "00615c63-8f57-4097-97fb-2f81d7dfc1bb" })
        .get({
          query: {},
          headers: {
            Cookie: sessionCookie,
          },
        });

      expect(error).not.toBeNull();
      expect(error?.status).toEqual(403);
      expect(data).toBeNull();
    });

    it("Can't get  private playlist(no auth)", async () => {
      const { data, error } = await api
        .playlist({ playlistId: "00615c63-8f57-4097-97fb-2f81d7dfc1bb" })
        .get({
          query: {},
        });

      expect(error).not.toBeNull();
      expect(error?.status).toEqual(403);
      expect(data).toBeNull();
    });

    it("Can't get a playlist(invalid playlistId)", async () => {
      const { data, error } = await api
        .playlist({ playlistId: "bc753baa-f159-4f16-b3d3-ad4224a62644" })
        .get({
          query: {},
        });

      expect(error).not.toBeNull();
      expect(error?.status).toEqual(404);
      expect(data).toBeNull();
    });

    it("Can get Browse(with assetKind filter)", async () => {
      const { data, error } = await api
        .playlist({ playlistId: "fd117185-bb7c-4345-b34c-a8a193ff3939" })
        .get({
          query: { assetKind: 2 },
        });
      expect(error).toBeNull();
      expect(data).toBeObject();
    });

    it("Can get Browse(with title search)", async () => {
      const { data, error } = await api
        .playlist({ playlistId: "fd117185-bb7c-4345-b34c-a8a193ff3939" })
        .get({
          query: { searchTerm: "kusi" },
        });
      expect(error).toBeNull();
      expect(data).toBeObject();
    });

    it("Can get Browse(with gamertag search)", async () => {
      const { data, error } = await api
        .playlist({ playlistId: "fd117185-bb7c-4345-b34c-a8a193ff3939" })
        .get({
          query: { gamertag: "CalebderMighty" },
        });
      expect(error).toBeNull();
      expect(data).toBeObject();
    });

    it("Can get Browse(with gamertag search ownerOnly true)", async () => {
      const { data, error } = await api
        .playlist({ playlistId: "fd117185-bb7c-4345-b34c-a8a193ff3939" })
        .get({
          query: { gamertag: "CalebderMighty", ownerOnly: true },
        });
      expect(error).toBeNull();
      expect(data).toBeObject();
    });

    it("Can get Browse(with tag search)", async () => {
      const { data, error } = await api
        .playlist({ playlistId: "fd117185-bb7c-4345-b34c-a8a193ff3939" })
        .get({
          query: { tags: "remake" },
        });
      expect(error).toBeNull();
      expect(data).toBeObject();
    });

    it("Can get Browse(sorted)", async () => {
      const { data, error } = await api
        .playlist({ playlistId: "fd117185-bb7c-4345-b34c-a8a193ff3939" })
        .get({
          query: { sort: "name" },
        });
      expect(error).toBeNull();
      expect(data).toBeObject();
    });
  });

  // describe("PUT /:playlistId", () => {
  //   it("Can  update a playlist", async () => {
  //     const { data, error } = await api
  //       .playlist({ playlistId: persistentPlaylist.assetId })
  //       .put(
  //         {
  //           name: "Unggoy Slaye",
  //           description: "this is a playlist for slayer maps loved by Unngoys",
  //           thumbnail: "test",
  //         },
  //         {
  //           headers: {
  //             Cookie: sessionCookie,
  //             Host: "localhost",
  //             Origin: "http://localhost",
  //           },
  //         },
  //       );
  //
  //     expect(error).toBeNull();
  //     expect(data).not.toBeNull();
  //   });
  //
  //   it("Can  update privacy status of a playlist", async () => {
  //     const { data, error } = await api
  //       .playlist({ playlistId: persistentPlaylist.assetId })
  //       .put(
  //         {
  //           isPrivate: true,
  //         },
  //         {
  //           headers: {
  //             Cookie: sessionCookie,
  //             Host: "localhost",
  //             Origin: "http://localhost",
  //           },
  //         },
  //       );
  //
  //     expect(error).toBeNull();
  //     expect(data).not.toBeNull();
  //   });
  //
  //   it("Can't update name of a playlist(duplicate name)", async () => {
  //     const { data, error } = await api
  //       .playlist({ playlistId: persistentPlaylist.assetId })
  //       .put(
  //         {
  //           name: "TestPlaylist1",
  //         },
  //         {
  //           headers: {
  //             Cookie: sessionCookie,
  //             Host: "localhost",
  //             Origin: "http://localhost",
  //           },
  //         },
  //       );
  //
  //     expect(error).not.toBeNull();
  //     expect(error?.status).toEqual(409);
  //     expect(data).toBeNull();
  //   });
  //
  //   it("Can't update a playlist(don't own)", async () => {
  //     const { data, error } = await api
  //       .playlist({ playlistId: "6a6b87a2-58fd-4c87-b2db-0df515269b32" })
  //       .put(
  //         {
  //           name: "Hacked Playlist",
  //         },
  //         {
  //           headers: {
  //             Cookie: sessionCookie,
  //             Host: "localhost",
  //             Origin: "http://localhost",
  //           },
  //         },
  //       );
  //
  //     expect(error).not.toBeNull();
  //     expect(error?.status).toEqual(403);
  //     expect(data).toBeNull();
  //   });
  //
  //   it("Can't update name of a playlist(no auth)", async () => {
  //     const { data, error } = await api
  //       .playlist({ playlistId: persistentPlaylist.assetId })
  //       .put(
  //         {
  //           name: "No Auth Playlist",
  //         },
  //         {
  //           headers: {
  //             Host: "localhost",
  //             Origin: "http://localhost",
  //           },
  //         },
  //       );
  //
  //     expect(error).not.toBeNull();
  //     expect(error?.status).toEqual(401);
  //     expect(data).toBeNull();
  //   });
  // });

  describe("Delete /:playlistId", () => {
    it("Can delete a playlist", async () => {
      const { data, error } = await api
        .playlist({ playlistId: persistentPlaylist.assetId })
        .delete(
          {},
          {
            headers: {
              Cookie: sessionCookie,
              Host: "localhost",
              Origin: "http://localhost",
            },
          },
        );

      expect(error).toBeNull();
      expect(data).not.toBeNull();
    });

    it("Can't delete a playlist(asset doesn't exist)", async () => {
      const { data, error } = await api
        .playlist({ playlistId: persistentPlaylist.assetId })
        .delete(
          {},
          {
            headers: {
              Cookie: sessionCookie,
              Host: "localhost",
              Origin: "http://localhost",
            },
          },
        );

      expect(error).not.toBeNull();
      expect(error?.status).toEqual(404);
      expect(data).toBeNull();
    });

    it("Can't delete a playlist(no auth)", async () => {
      const { data, error } = await api
        .playlist({ playlistId: "fd117185-bb7c-4345-b34c-a8a193ff3939" })
        .delete(
          {},
          {
            headers: {
              Host: "localhost",
              Origin: "http://localhost",
            },
          },
        );

      expect(error).not.toBeNull();
      expect(error?.status).toEqual(401);
      expect(data).toBeNull();
    });

    it("Can't delete a playlist(don't own asset)", async () => {
      const { data, error } = await api
        .playlist({ playlistId: "6a6b87a2-58fd-4c87-b2db-0df515269b32" })
        .delete(
          {},
          {
            headers: {
              Cookie: sessionCookie,
              Host: "localhost",
              Origin: "http://localhost",
            },
          },
        );

      expect(error).not.toBeNull();
      expect(error?.status).toEqual(403);
      expect(data).toBeNull();
    });
  });

  describe("GET /browse", () => {
    it("Can get playlist browse(no query params)", async () => {
      const { data, error } = await api.playlist.browse.get({ query: {} });
      expect(error).toBeNull();
      expect(data).toBeObject();
    });

    it("Can get playlist browse(with title search)", async () => {
      const { data, error } = await api.playlist.browse.get({
        query: { searchTerm: "kusi" },
      });
      expect(error).toBeNull();
      expect(data).toBeObject();
    });

    it("Can get playlist browse(with gamertag search)", async () => {
      const { data, error } = await api.playlist.browse.get({
        query: { gamertag: "CalebderMighty" },
      });
      expect(error).toBeNull();
      expect(data).toBeObject();
    });

    it("Can get playlist browse(sorted)", async () => {
      const { data, error } = await api.playlist.browse.get({
        query: { sort: "name" },
      });
      expect(error).toBeNull();
      expect(data).toBeObject();
    });
  });

  describe("GET /me", () => {
    it("Can get own playlists", async () => {
      const { data, error } = await api.playlist.browse.get({
        headers: {
          Cookie: sessionCookie,
        },
        query: {},
      });
      expect(error).toBeNull();
      expect(data).toBeObject();
    });

    it("Can get own playlists(with title search)", async () => {
      const { data, error } = await api.playlist.me.get({
        headers: {
          Cookie: sessionCookie,
        },

        query: { searchTerm: "Test Playlist" },
      });
      expect(error).toBeNull();
      expect(data).toBeObject();
    });

    it("Can get own playlists (sorted)", async () => {
      const { data, error } = await api.playlist.me.get({
        headers: {
          Cookie: sessionCookie,
        },

        query: { sort: "name" },
      });
      expect(error).toBeNull();
      expect(data).toBeObject();
    });

    it("Can't get own playlists (no auth)", async () => {
      const { data, error } = await api.playlist.me.get({
        query: {},
      });
      expect(error).not.toBeNull();
      expect(error?.status).toEqual(401);
      expect(data).toBeNull();
    });
  });
});
