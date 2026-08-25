export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 دقيقة
export const REFRESH_TOKEN_TTL_DAYS = 7;
export const TOKEN_VERSION_CACHE_TTL_SECONDS = 60;

export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_LOCK_MINUTES = 15;

export const OTP_TTL_MINUTES = 5;
export const OTP_MAX_ATTEMPTS = 5;

export const PASSWORD_RESET_TTL_MINUTES = 15;

// أسماء كوكيز المصادقة معرَّفة في lib/cookies.ts (تعتمد على NODE_ENV) — لا تُكرَّر هنا

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 50;

export const JSON_BODY_LIMIT = "200kb";

export const TRIAL_DAYS = 14;
