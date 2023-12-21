// import Elysia from "elysia";
// import { authApp } from "../middleware";
// import { lucia } from "../lucia";
//
// authApp.get("/logout", async (context) => {
//   if (!context.user) {
//     return new Response(null, {
//       status: 401,
//     });
//   }
//   await lucia.invalidateSession(session)
//   await auth.invalidateSession(session.sessionId);
//   authRequest.setSession(null);
//   //redirect back to login page
//   context.set.redirect = "/login";
//   return;
// });
