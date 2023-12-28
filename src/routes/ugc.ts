import Elysia from "elysia";
import { authApp } from "../middleware";
import { load } from "cheerio";

export const maps = new Elysia()
  .use(authApp)
  .get("/maps/:assetId", async ({ params: { assetId } }) => {
    const ugcEndpoint =
      "https://www.halowaypoint.com/halo-infinite/ugc/maps/" + assetId;
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
        throw new Error("No UGC data found try logging in for better results");
      }

      const jsonContent = JSON.parse(scriptTag.html() || "{}");
      const asset = jsonContent.props?.pageProps?.asset;

      return asset;
    } catch (error) {
      console.error(error);
      throw error;
    }
  })
  .get("/browse", async ({ query: { assetKind, sort, order, page } }) => {
    const ugcEndpoint =
      "https://www.halowaypoint.com/halo-infinite/ugc/browse?";
    const queryParams: UgcFetchData = {
      assetKind: assetKind ?? undefined,
      sort: sort ?? "datepublishedutc",
      order: order ?? "desc",
      page: page ?? "1",
    };
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
        throw new Error("No UGC data found try logging in for better results");
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
  });

export interface UgcFetchData {
  assetKind?: string; //'Map' | 'Mode' | 'Prefab';
  sort?: string; //'datepublishedutc';
  order?: string; //'desc' | 'asc';
  page?: string; //number
}
export interface UgcData {
  assetId: string;
  assetVersionId: string;
  name: string;
  description: string;
  assetKind: number; //replace with enumm for map, variant, prefab
  tags?: string[]; // list of tags, might replace with diff data type
  thumbnail: string;
  refrencedAssets?: string[]; //Seems unused but idk???
  originalAuthor: string; // of the form "xuid(123123123123)"
  likes: number;
  bookmarks: number;
  playsRecent: number;
  numberOfObjects: number;
  dateCreated: Date; //UTC ISO8601 date format
  dateModified: Date; //UTC ISO8601 date format
  datePublished: Date; //UTC ISO8601 date format
  hasNodeGraph: boolean;
  readOnlyClones: boolean;
  playsAllTime: number;
  contributors: string[]; // of the form "xuid()"
  parentAssetCount: number;
  averageRating: number; // float/double
  numberOfRatings: number;
  profilePicture: string;
}
