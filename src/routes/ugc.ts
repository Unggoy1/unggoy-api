import Elysia from "elysia";
import { authApp } from "../middleware";

export const maps = new Elysia()
  .use(authApp)
  .get("/maps/:assetId", async ({ params: { assetId } }) => {
    const ugcEndpoint =
      "https://discovery-infiniteugc.svc.halowaypoint.com/hi/maps/ef006625-5780-4d94-abf5-67ec0236a453/" +
      assetId;

    try {
      const response = await fetch(ugcEndpoint, {
        method: "GET",
        headers: {
          "x-343-authorization-spartan": "rst",
        },
      });

      if (!response.ok) {
        throw new Error(`failed to fetch data. Status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching data:", error);
      throw error;
    }
  });
