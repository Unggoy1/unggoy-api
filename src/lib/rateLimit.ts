import { Generator } from "elysia-rate-limit";

export const cloudflareGenerator: Generator = (req, server) =>
  // get client ip via cloudflare header first
  req.headers.get("CF-Connecting-IP") ??
  // if not found, fallback to default generator
  server?.requestIP(req)?.address ??
  "";
