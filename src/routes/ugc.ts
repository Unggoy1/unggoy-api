import Elysia from "elysia";
import { authApp } from "../middleware";

export const maps = new Elysia()
  .use(authApp)
  .get("/maps/:assetId", async ({ params: { assetId } }) => {
    const ugcEndpoint =
      "https://discovery-infiniteugc.svc.halowaypoint.com/hi/maps/ef006625-5780-4d94-abf5-67ec0236a453/" +
      assetId;
    const ugcEndpointTemp =
      "https://www.halowaypoint.com/_next/data/l_iVqOweZfILKOKRoCSTz/en-us/halo-infinite/ugc/maps/" +
      assetId +
      ".json";

    try {
      const response = await fetch(ugcEndpointTemp);

      if (!response.ok) {
        throw new Error(`failed to fetch data. Status: ${response.status}`);
      }

      const data = await response.json();
      const res = data.pageProps.asset;
      return res;
    } catch (error) {
      console.error("Error fetching data:", error);
      throw error;
    }
  });
