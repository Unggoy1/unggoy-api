import Elysia from "elysia";
import { authApp } from "../middleware";
import { getSpartanToken } from "../authTools";

export const cms = new Elysia().group("/cms", (app) => {
  return app.use(authApp).get("/emblem", async ({ user }) => {
    if (!user) {
      return new Response(null, {
        status: 401,
      });
    }

    const haloTokens = await getSpartanToken(user.id);
    if (!haloTokens) {
      return new Response(null, {
        status: 401,
      });
    }

    const appearanceEndpoint = `https://economy.svc.halowaypoint.com/hi/players/xuid(${user.xuid})/customization/appearance`;
    const headers: HeadersInit = {
      "X-343-Authorization-Spartan": haloTokens.spartanToken,
      "343-Clearance": haloTokens.clearanceToken,
    };
    try {
      const response = await fetch(appearanceEndpoint, {
        method: "GET",
        headers: headers,
      });

      if (!response.ok) {
        throw new Error(`failed to fetch data. Status: ${response.status}`);
      }
      const appearanceData: EconomyAppearance = await response.json();

      const configurationJsonEndpoint = `https://gamecms-hacs.svc.halowaypoint.com/hi/progression/file/`;

      return appearanceData;
    } catch (error) { }
  });
});

interface EconomyAppearance {
  Status: string;
  Appearance: {
    LastModifiedDateUtc: {
      ISO8601Date: string;
    };
    ActionPosePath: string;
    BackdropImagePath: string;
    Emblem: {
      EmblemPath: string;
      ConfigurationId: number;
    };
    ServiceTag: string;
    IntroEmotePath?: string;
    PlayerTitlePath?: string;
  };
}
