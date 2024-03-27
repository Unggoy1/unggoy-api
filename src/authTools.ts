import { client } from "./lucia";
import { refreshSpartanToken } from "./auth";

export async function getSpartanToken(userId) {
  let oauth = await client.oauth.findFirst({
    where: {
      userId: userId,
    },
  });

  if (!oauth) {
    throw new Error("lolm8 no oauth here");
  }
  const time: Date = new Date();

  // Calculate the time 5 minutes from now
  const currentTime: Date = new Date(time.getTime() - 5 * 60000); // 5 minutes in milliseconds

  // Check if `prismaDatetime` is before `fiveMinutesFromNow`
  if (oauth.spartanToken && oauth.spartanTokenExpiresAt > currentTime) {
    try {
      const tokens = await refreshSpartanToken(oauth.refreshToken);

      oauth = await client.oauth.update({
        where: {
          userId: userId,
        },
        data: {
          spartanToken: tokens.spartanToken.SpartanToken,
          spartanTokenExpiresAt: tokens.spartanToken.ExpiresUtc.ISO8601Date,
          refreshToken: tokens.refreshToken,
        },
      });
    } catch (error) {
      return undefined;
      //TODO figure out best way to handle this error and inform the user that they need to log into our app again.
      //In theory this should never happen if we set our session lifespan to the same exact lifespan of the refresh token
    }
  }

  return oauth.spartanToken;
}
