import { Elysia, t } from "elysia";
import { lucia, entraId } from "../lucia";
import prisma from "../prisma";
import { authApp } from "../middleware";
import { getAppearance, getSpartanToken } from "../authTools";
import {
  generateState,
  generateCodeVerifier,
  MicrosoftEntraIdTokens,
  OAuth2RequestError,
} from "arctic";
import { generateId } from "lucia";
import { parseJWT } from "oslo/jwt";
import { jwtDecode } from "jwt-decode";
import { entraIdTokenPayload } from "../interface";
import { getGamertag, refreshSpartanToken } from "../auth";
import { rateLimit } from "elysia-rate-limit";
import { TooManyRequests, Unknown } from "../lib/errors";
import { cloudflareGenerator } from "../lib/rateLimit";
import { server } from "..";

let allowedDomain = process.env.CORS_URL || "localhost:5137";

export const login = new Elysia()
  .use(
    rateLimit({
      scoping: "scoped",
      errorResponse: new TooManyRequests(),
      generator: cloudflareGenerator,
      injectServer: () => {
        return server!;
      },
    }),
  )
  .group("/login", (app) => {
    return (
      app
        // .use(authApp)
        .get(
          "/azure",
          async ({
            query: { redirectUrl },
            set,
            cookie: { entra_oauth_state, entra_oauth_verifier, redirect_url },
            redirect,
            // user,
          }) => {
            //TODO Research if this should be removed, or how we handle sessions when you try to relogin when session is active
            // if (user) {
            //   set.status = 302;
            //   set.redirect = "/";
            //   return user;
            // }
            // redirect_url.set({
            //   value: redirectUrl || process.env.URL || "http://localhost:5173",
            //   httpOnly: true,
            //   secure: process.env.NODE_ENV === "production",
            //   path: "/",
            //   maxAge: 60 * 60,
            // });
            const state = generateState();
            const codeVerifier = generateCodeVerifier();
            
            console.log("Creating authorization URL with:", {
              clientId: process.env.AZURE_CLIENT_ID ? "set" : "missing",
              clientSecret: process.env.AZURE_CLIENT_SECRET ? "set" : "missing",
              redirectURI: process.env.AZURE_REDIRECT_URI
            });
            
            const authorizationUrl = await entraId.createAuthorizationURL(
              state,
              codeVerifier,
              {
                scopes: [
                  "Xboxlive.signin",
                  "Xboxlive.offline_access",
                  "profile",
                ],
              },
            );
            
            console.log("Authorization URL created:", authorizationUrl.toString());

            entra_oauth_state.set({
              value: state,
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              path: "/",
              maxAge: 60 * 60,
            });
            entra_oauth_verifier.set({
              value: codeVerifier,
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              path: "/",
              maxAge: 60 * 60,
            });
            redirect_url.set({
              value: redirectUrl,
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              path: "/",
              maxAge: 60 * 60,
            });
            set.headers["Cache-Control"] = "private, no-store, max-age=0";
            
            return redirect(authorizationUrl.toString());
          },
          {
            query: t.Object({
              redirectUrl: t.String({
                format: "uri",
                pattern: `^https?://${allowedDomain.replace(/\./g, "\\.")}(/.*)?$`,
                error: "Invalid redirect url",
              }),
            }),
          },
        )
        .get(
          "/azure-ad/callback",
          async ({
            query,
            set,
            cookie: {
              auth_session,
              entra_oauth_state,
              entra_oauth_verifier,
              redirect_url,
            },
            redirect,
          }) => {
            const storedState = entra_oauth_state.value;
            const codeVerifier = entra_oauth_verifier.value;
            const state = query.state;
            const code = query.code;
            //validatestate
            if (
              !storedState ||
              !state ||
              storedState !== state ||
              typeof code !== "string" ||
              !storedState ||
              typeof storedState !== "string" ||
              !codeVerifier ||
              !redirect_url.value
            ) {
              set.status = 400;
              entra_oauth_state.remove();
              entra_oauth_verifier.remove();
              redirect_url.remove();
              return;
            }
            const redirectUrl = new URL(redirect_url.value);
            entra_oauth_state.remove();
            entra_oauth_verifier.remove();
            redirect_url.remove();

            try {
              const tokens: MicrosoftEntraIdTokens =
                await entraId.validateAuthorizationCode(code, codeVerifier);
              const user = await jwtDecode<entraIdTokenPayload>(tokens.idToken);
              const xboxUser = await getGamertag(tokens.refreshToken!);

              if (!xboxUser) {
                throw new Error("Xbox Authentication Error");
              }
              const spartanUserId = process.env.OAUTH_USER;
              if (!spartanUserId) {
                throw new Unknown();
              }
              const haloTokens = await getSpartanToken(spartanUserId);
              if (!haloTokens) {
                throw new Error(`failed to fetch emblem data`);
              }

              const headers: HeadersInit = {
                "X-343-Authorization-Spartan": haloTokens.spartanToken,
                "343-Clearance": haloTokens.clearanceToken,
              };
              const appearance = await getAppearance(xboxUser.xuid, headers);
              appearance.emblemPath = appearance.emblemPath.startsWith("/")
                ? appearance.emblemPath
                : "/" + appearance.emblemPath;
              const existingUser = await prisma.user.findFirst({
                where: {
                  oid: user.oid,
                },
              });
              if (existingUser) {
                if (
                  existingUser.username !== xboxUser.gamertag ||
                  existingUser.serviceTag !== appearance.serviceTag ||
                  existingUser.emblemPath !== appearance.emblemPath
                ) {
                  await prisma.user.update({
                    where: {
                      oid: user.oid,
                    },
                    data: {
                      username: xboxUser.gamertag,
                      serviceTag: appearance.serviceTag,
                      emblemPath: appearance.emblemPath,
                    },
                  });
                }
                const session = await lucia.createSession(existingUser.id, {});
                const sessionCookie = lucia.createSessionCookie(session.id);
                auth_session.set({
                  value: sessionCookie.value,
                  ...sessionCookie.attributes,
                });
                //TODO: dont store oauth until we confirm we can do things such as importing peoples bookmarks, or complex stuff with infinite api

                // await prisma.oauth.update({
                //   where: {
                //     userId: existingUser.id,
                //   },
                //   data: {
                //     spartanToken: xboxUser.spartanToken.SpartanToken,
                //     spartanTokenExpiresAt:
                //       xboxUser.spartanToken.ExpiresUtc.ISO8601Date,
                //     refreshToken: xboxUser.refreshToken,
                //     clearanceToken: xboxUser.clearanceToken,
                //   },
                // });

                set.headers["Cache-Control"] = "private, no-store, max-age=0";
                
                return redirect(redirectUrl.toString());
              }

              const userId = generateId(15);

              await prisma.user.create({
                data: {
                  id: userId,
                  username: xboxUser.gamertag,
                  oid: user.oid,
                  xuid: xboxUser.xuid,
                  serviceTag: appearance.serviceTag,
                  emblemPath: appearance.emblemPath.startsWith("/")
                    ? appearance.emblemPath
                    : "/" + appearance.emblemPath,
                },
              });

              //TODO: dont store oauth until we confirm we can do things such as importing peoples bookmarks, or complex stuff with infinite api

              // await prisma.oauth.create({
              //   data: {
              //     userId: userId,
              //     spartanToken: xboxUser.spartanToken.SpartanToken,
              //     spartanTokenExpiresAt:
              //       xboxUser.spartanToken.ExpiresUtc.ISO8601Date,
              //     refreshToken: xboxUser.refreshToken,
              //     clearanceToken: xboxUser.clearanceToken,
              //   },
              // });

              const session = await lucia.createSession(userId, {});
              const sessionCookie = lucia.createSessionCookie(session.id);
              auth_session.set({
                value: sessionCookie.value,
                ...sessionCookie.attributes,
              });
              //TODO Look at the sessionCookie.attrubute
              //TODO See what attributes should be used for spartan token cookie
              //TODO See how we can refresh this spartan token as long as our session is active
              set.headers["Cache-Control"] = "private, no-store, max-age=0";
              
              return redirect(redirectUrl.toString());
            } catch (error) {
              console.error(error);
              if (error instanceof OAuth2RequestError) {
                set.status = 400;
                return;
              }
              set.status = 500;
              return;
            }
          },
        )
    );
  });
