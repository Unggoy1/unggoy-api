import prisma from "./prisma";
import { refreshSpartanToken } from "./auth";

export async function getSpartanToken(userId: string) {
  let oauth = await prisma.oauth.findFirst({
    where: {
      userId: userId,
    },
  });

  if (!oauth) {
    throw new Error("lolm8 no oauth here");
  }
  const time: Date = new Date();

  // Calculate the time 5 minutes from now
  const currentTime: Date = new Date(time.getTime() + 5 * 60000); // 5 minutes in milliseconds

  // Check if `prismaDatetime` is before `fiveMinutesFromNow`
  if (oauth.spartanToken && oauth.spartanTokenExpiresAt < currentTime) {
    try {
      const tokens = await refreshSpartanToken(oauth.refreshToken);

      oauth = await prisma.oauth.update({
        where: {
          userId: userId,
        },
        data: {
          spartanToken: tokens.spartanToken.SpartanToken,
          spartanTokenExpiresAt: tokens.spartanToken.ExpiresUtc.ISO8601Date,
          refreshToken: tokens.refreshToken,
          clearanceToken: tokens.clearanceToken,
        },
      });
    } catch (error) {
      return undefined;
      //TODO figure out best way to handle this error and inform the user that they need to log into our app again.
      //In theory this should never happen if we set our session lifespan to the same exact lifespan of the refresh token
    }
  }

  return {
    spartanToken: oauth.spartanToken,
    clearanceToken: oauth.clearanceToken,
  };
}

export async function getAppearance(
  xuid: string,
  headers: HeadersInit,
  // assetId: string,
) {
  const appearance1 = "https://economy.svc.halowaypoint.com/hi/players/"; //xuid(${user.xuid})/customization/apperance
  const appearance2 = "/customization";
  const emblemEndpoint =
    "https://gamecms-hacs.svc.halowaypoint.com/hi/progression/file/"; //Inventory/Spartan/Emblems/blah.json
  try {
    const response = await fetch(appearance1 + `xuid(${xuid})` + appearance2, {
      method: "GET",
      headers: headers,
    });
    if (!response.ok) {
      // Sentry.captureMessage(`Error: Failed to fetch appearance`, {
      //   extra: {
      //     endpoint:
      //       UgcEndpoints.Appearance1 +
      //       `xuid(${xuid})` +
      //       UgcEndpoints.Appearance2,
      //     code: response.status,
      //     xuid: xuid,
      //     assetId: assetId,
      //   },
      // });
      throw new Error(`failed to fetch apperance. Status: ${response.status}`);
    }

    const result = await response.json();

    const emblemResponse = await fetch(
      emblemEndpoint + result.Appearance.Emblem.EmblemPath,
      {
        method: "GET",
        headers: headers,
      },
    );

    if (!emblemResponse.ok) {
      // Sentry.captureMessage(`Error: Failed to fetch emblem`, {
      //   extra: {
      //     endpoint: UgcEndpoints.Emblem,
      //     emblemPath: result.Appearance.Emblem.EmblemPath,
      //     code: response.status,
      //     xuid: xuid,
      //     assetId: assetId,
      //   },
      // });
      throw new Error(`failed to fetch data. Status: ${response.status}`);
    }
    const emblem = await emblemResponse.json();
    let emblemPath = emblem.CommonData.DisplayPath.Media.MediaUrl.Path;
    const fixedEmblemPath =
      emblemPath != ""
        ? emblemPath.replace(/^progression\/Inventory\//, "")
        : "Emblems/classics_one_emblem.png";
    return {
      serviceTag: result.Appearance.ServiceTag,
      emblemPath: fixedEmblemPath.toLowerCase(),
    };
  } catch (error) {
    throw error;
  }
}
