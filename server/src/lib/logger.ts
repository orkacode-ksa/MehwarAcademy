import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "token",
      "authorization",
      "cookie",
      "secret",
      "otp",
      "*.password",
      "*.token",
      "*.passwordHash",
      "*.totpSecret",
    ],
    censor: "[REDACTED]",
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
});
