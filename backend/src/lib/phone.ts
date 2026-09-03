import { z } from "zod";

export const E164_RE = /^\+[1-9]\d{7,14}$/;

export const e164Phone = z.string().trim().regex(E164_RE).max(16);

export const optionalE164Phone = z.union([z.literal(""), e164Phone]).optional();
