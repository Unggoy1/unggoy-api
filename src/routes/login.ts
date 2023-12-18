import Elysia from "elysia";
import { auth, azureAuth } from "../lucia";
import { parseCookie } from "lucia/utils";
import { OAuthRequestError } from "@lucia-auth/oauth";

const azureCallback = new Elysia().get("/xbox/callback", async (context) => {
  const cookies = parseCookie(context.request.headers.get("Cookie") ?? "");
  const storedState = cookies.azure_oauth_state;
  console.log(storedState);
  const codeVerifier = cookies.azure_oauth_verifier;
  console.log(codeVerifier);
  const state = context.query.state;
  console.log(state);
  const code = context.query.code;
  console.log(code);
  //validatestate
  if (
    !storedState ||
    !state ||
    storedState !== state ||
    typeof code !== "string" ||
    !storedState ||
    typeof storedState !== "string"
  ) {
    console.log("ahahahahah");
    context.set.status = 400;
    return;
  }
  try {
    console.log("trying to validateCallback");
    const { getExistingUser, azureADUser, createUser } =
      await azureAuth.validateCallback(code, codeVerifier);
    console.log(azureADUser);

    const getUser = async () => {
      const existingUser = await getExistingUser();
      if (existingUser) return existingUser;
      const user = await createUser({
        attributes: {
          username: azureADUser.name,
        },
      });
      return user;
    };

    const user = await getUser();
    const session = await auth.createSession({
      userId: user.userId,
      attributes: {},
    });

    const authRequest = auth.handleRequest(context);
    authRequest.setSession(session);
    context.set.status = 302;
    context.set.redirect = "/";
    return;
  } catch (error) {
    if (error instanceof OAuthRequestError) {
      console.log(error.message);
      console.log(error.response);
      context.set.status = 400;
      return;
    }

    context.set.status = 500;
    return;
  }
});

const azure = new Elysia().get(
  "/azure",
  async ({ set, cookie: { azure_oauth_state, azure_oauth_verifier } }) => {
    const [url, codeVerifier, state] = await azureAuth.getAuthorizationUrl();

    azure_oauth_state.set({
      value: state,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60,
    });
    azure_oauth_verifier.set({
      value: codeVerifier,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60,
    });
    set.status = 302;
    set.redirect = url.toString();
  },
);

export const login = new Elysia().group("/login", (app) => {
  return app.use(azure).use(azureCallback);
});
