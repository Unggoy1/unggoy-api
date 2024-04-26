import Elysia from "elysia";
import { authApp } from "../middleware";
import { load } from "cheerio";
import { getSpartanToken } from "../authTools";
import { toString } from "cheerio/lib/api/manipulation";

export const maps = new Elysia().group("/ugc", (app) => {
  return app
    .use(authApp)
    .get("/maps/:assetId", async ({ user, params: { assetId } }) => {
      let token: string | undefined;
      if (user) {
        console.log("we hab user");
        token = (await getSpartanToken(user.id))?.spartanToken;
      }
      const ugcEndpoint = token
        ? "https://discovery-infiniteugc.svc.halowaypoint.com/hi/maps/" +
        assetId
        : "https://www.halowaypoint.com/halo-infinite/ugc/maps/" + assetId;
      const headers: HeadersInit = {};
      if (token) {
        headers["X-343-Authorization-Spartan"] = token;
      }
      try {
        console.log(ugcEndpoint);
        const response = await fetch(ugcEndpoint, {
          method: "GET",
          headers: headers,
        });

        if (!response.ok) {
          throw new Error(`failed to fetch data. Status: ${response.status}`);
        }

        if (token) {
          return await response.json();
        }

        const htmlContent = await response.text();
        const $ = load(htmlContent);

        const scriptTag = $("#__NEXT_DATA__");

        if (scriptTag.length === 0) {
          throw new Error(
            "No UGC data found try logging in for better results",
          );
        }

        const jsonContent = JSON.parse(scriptTag.html() || "{}");
        const asset = jsonContent.props?.pageProps?.asset;

        return asset;
      } catch (error) {
        console.error(error);
        throw error;
      }
    })
    .get("/modes/:assetId", async ({ params: { assetId } }) => {
      const ugcEndpoint =
        "https://www.halowaypoint.com/halo-infinite/ugc/modes/" + assetId;
      try {
        const response = await fetch(ugcEndpoint, {
          method: "GET",
          // headers: {
          //   "x-343-authorization-spartan": "rst",
          // },
        });

        if (!response.ok) {
          throw new Error(`failed to fetch data. Status: ${response.status}`);
        }

        const htmlContent = await response.text();
        const $ = load(htmlContent);

        const scriptTag = $("#__NEXT_DATA__");

        if (scriptTag.length === 0) {
          throw new Error(
            "No UGC data found try logging in for better results",
          );
        }

        const jsonContent = JSON.parse(scriptTag.html() || "{}");
        const asset = jsonContent.props?.pageProps?.asset;

        return asset;
      } catch (error) {
        console.error(error);
        throw error;
      }
    })
    .get("/prefabs/:assetId", async ({ params: { assetId } }) => {
      const ugcEndpoint =
        "https://www.halowaypoint.com/halo-infinite/ugc/prefabs/" + assetId;
      try {
        const response = await fetch(ugcEndpoint, {
          method: "GET",
          // headers: {
          //   "x-343-authorization-spartan": "rst",
          // },
        });

        if (!response.ok) {
          throw new Error(`failed to fetch data. Status: ${response.status}`);
        }

        const htmlContent = await response.text();
        const $ = load(htmlContent);

        const scriptTag = $("#__NEXT_DATA__");

        if (scriptTag.length === 0) {
          throw new Error(
            "No UGC data found try logging in for better results",
          );
        }

        const jsonContent = JSON.parse(scriptTag.html() || "{}");
        const asset = jsonContent.props?.pageProps?.asset;

        return asset;
      } catch (error) {
        console.error(error);
        throw error;
      }
    })

    .get(
      "/browse",
      async ({ query: { assetKind, sort, order, page, searchTerm } }) => {
        const ugcEndpoint =
          "https://www.halowaypoint.com/halo-infinite/ugc/browse?";
        const queryParams: UgcFetchData = {
          sort: sort ?? "datepublishedutc",
          order: order ?? "desc",
          page: page ?? "1",
        };
        if (assetKind) {
          queryParams.assetKind = assetKind;
        }
        if (searchTerm) {
          queryParams.searchTerm = searchTerm;
        }
        try {
          const response = await fetch(
            ugcEndpoint + new URLSearchParams({ ...queryParams }),
          );

          if (!response.ok) {
            throw new Error(`failed to fetch data. Status: ${response.status}`);
          }
          const htmlContent = await response.text();
          const $ = load(htmlContent);

          const scriptTag = $("#__NEXT_DATA__");

          if (scriptTag.length === 0) {
            throw new Error(
              "No UGC data found try logging in for better results",
            );
          }
          const jsonContent = JSON.parse(scriptTag.html() || "{}");
          const results = {
            results: jsonContent.props?.pageProps?.results,
            totalPages: jsonContent.props?.pageProps?.totalPages,
            totalResults: jsonContent.props?.pageProps?.totalResults,
            pageSize: jsonContent.props?.pageProps?.pageSize,
          };
          return results;
        } catch (error) {
          console.error(error);
          throw error;
        }
      },
    );
});

export interface UgcFetchData {
  assetKind?: string; //'Map' | 'Mode' | 'Prefab';
  sort?: string; //'datepublishedutc';
  order?: string; //'desc' | 'asc';
  page?: string; //number
  searchTerm?: string;
}
export interface UgcData {
  AssetId: string;
  AssetVersionId: string;
  Name: string;
  Description: string;
  AssetKind: number; //replace with enumm for map, variant, prefab
  Tags?: string[]; // list of tags, might replace with diff data type
  ThumbnailUrl: string;
  RefrencedAssets?: string[]; //Seems unused but idk???
  OriginalAuthor: string; // of the form "xuid(123123123123)"
  Likes: number;
  Bookmarks: number;
  PlaysRecent: number;
  NumberOfObjects: number;
  DateCreatedUtc: {
    ISO8601Date: Date;
  };

  DateModifiedUtc: {
    ISO8601Date: Date;
  };
  DatePublishedUtc: {
    ISO8601Date: Date;
  };
  HasNodeGraph: boolean;
  ReadOnlyClones: boolean;
  PlaysAllTime: number;
  Contributors: string[]; // of the form "xuid()"
  ParentAssetCount: number;
  AverageRating: number; // float/double
  NumberOfRatings: number;
}
