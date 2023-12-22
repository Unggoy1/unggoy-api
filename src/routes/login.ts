import Elysia from "elysia";
import { lucia, entraId, client } from "../lucia";
import { authApp } from "../middleware";
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

export const login = new Elysia().group("/login", (app) => {
  return app
    .use(authApp)
    .get(
      "/azure",
      async ({
        set,
        cookie: { entra_oauth_state, entra_oauth_verifier },
        user,
      }) => {
        if (user) {
          set.status = 302;
          set.redirect = "/";
          return user;
        }

        const state = generateState();
        const codeVerifier = generateCodeVerifier();
        const authorizationUrl = await entraId.createAuthorizationURL(
          state,
          codeVerifier,
        );

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
        set.status = 302;
        set.redirect = authorizationUrl.toString();
      },
    )
    .get(
      "/azure-ad/callback",
      async ({
        query,
        set,
        cookie: { auth_session, entra_oauth_state, entra_oauth_verifier },
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
          typeof storedState !== "string"
        ) {
          set.status = 400;
          return;
        }
        try {
          const tokens: MicrosoftEntraIdTokens =
            await entraId.validateAuthorizationCode(code, codeVerifier);

          const user = await jwtDecode<entraIdTokenPayload>(tokens.idToken);
          const oslouser = await parseJWT(tokens.idToken);
          console.log(oslouser);

          const existingUser = await client.user.findFirst({
            where: {
              oid: user.oid,
            },
          });

          if (existingUser) {
            const session = await lucia.createSession(existingUser.id, {});
            const sessionCookie = lucia.createSessionCookie(session.id);
            auth_session.set({
              value: sessionCookie.value,
              ...sessionCookie.attributes,
            });
            set.status = 302;
            set.redirect = "/";
            return;
          }

          const userId = generateId(15);

          await client.user.create({
            data: {
              id: userId,
              username: user.name,
              oid: user.oid,
            },
          });

          const session = await lucia.createSession(userId, {});
          const sessionCookie = lucia.createSessionCookie(session.id);
          auth_session.set({
            value: sessionCookie.value,
            ...sessionCookie.attributes,
          });
          set.status = 302;
          set.redirect = "/";
          return;
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
    );
});
