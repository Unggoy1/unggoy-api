// import Elysia from "elysia";
// import { authApp } from "../middleware";
// import { lucia } from "../lucia";
//
// export const logout = new Elysia()
//   .use(authApp)
//   .get("/logout", async (context) => {
//     if (!context.user || !context.session) {
//       return new Response(null, {
//         status: 401,
//       });
//     }
//     await lucia.invalidateSession(context.session.id);
//     const sessionCookie = lucia.createBlankSessionCookie();
//     context.cookie[sessionCookie.name].set({
//       value: sessionCookie.value,
//       ...sessionCookie.attributes,
//     });
//
//     //redirect back to login page
//     context.set.redirect = "/";
//     return;
//   });
