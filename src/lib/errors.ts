import { Elysia } from "elysia";

export class Unknown extends Error {
  constructor(
    public message: string = "Unknown Error",
    public status = 400,
  ) {
    super(message);
  }
}

export class Unauthorized extends Error {
  constructor(
    public message: string = "Unauthorized",
    public status = 401,
  ) {
    super(message);
  }
}

export class Forbidden extends Error {
  constructor(
    public message: string = "Forbidden",
    public status = 403,
  ) {
    super(message);
  }
}

export class NotFound extends Error {
  constructor(
    public message: string = "Not Found",
    public status = 404,
  ) {
    super(message);
  }
}

export class Duplicate extends Error {
  constructor(
    public message: string = "Duplicate Entity",
    public status = 409,
  ) {
    super(message);
  }
}
