import { env } from "@/config/env";
import { ApiError } from "@/api/errors";
import type { ApiErrorBody } from "@/types/api";

const AUTH_TOKEN_KEY = "chatpool-access-token";

export type UnauthorizedReason = "SESSION_REVOKED" | "SESSION_EXPIRED" | "UNAUTHORIZED";

let onUnauthorized: ((reason: UnauthorizedReason, message: string) => void) | null = null;
let onForbidden: ((message: string) => void) | null = null;

export function setUnauthorizedHandler(
  handler: (reason: UnauthorizedReason, message: string) => void
) {
  onUnauthorized = handler;
}

export function setForbiddenHandler(handler: (message: string) => void) {
  onForbidden = handler;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAccessToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  auth?: boolean;
  /** Si false, no dispara forceLogout automático en 401 (p. ej. validateSession). */
  notifyUnauthorized?: boolean;
}

function resolveUnauthorizedReason(code?: string): UnauthorizedReason {
  if (code === "SESSION_REVOKED") return "SESSION_REVOKED";
  return "UNAUTHORIZED";
}

function notifyHttpError(
  status: number,
  errorBody: ApiErrorBody,
  auth: boolean,
  notifyUnauthorized: boolean
) {
  if (status === 401 && auth && notifyUnauthorized && !env.useMock) {
    const reason = resolveUnauthorizedReason(errorBody.code);
    onUnauthorized?.(reason, errorBody.message);
    return;
  }

  if (status === 403 && !env.useMock) {
    onForbidden?.(errorBody.message || "No tienes permiso para esta acción");
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, notifyUnauthorized = true, headers, ...init } = options;

  const requestHeaders = new Headers(headers);
  if (body !== undefined && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (auth) {
    const token = getAccessToken();
    if (token) {
      requestHeaders.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(`${env.apiUrl}${path}`, {
    ...init,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let errorBody: ApiErrorBody = { message: response.statusText || "Error de API" };
    try {
      errorBody = (await response.json()) as ApiErrorBody;
    } catch {
      // ignore invalid JSON
    }

    notifyHttpError(response.status, errorBody, auth, notifyUnauthorized);
    throw new ApiError(response.status, errorBody);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function apiUpload<T>(
  path: string,
  formData: FormData,
  options: Omit<RequestOptions, "body"> = {}
): Promise<T> {
  const { auth = true, notifyUnauthorized = true, headers, ...init } = options;

  const requestHeaders = new Headers(headers);

  if (auth) {
    const token = getAccessToken();
    if (token) {
      requestHeaders.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(`${env.apiUrl}${path}`, {
    ...init,
    method: "POST",
    headers: requestHeaders,
    body: formData,
  });

  if (!response.ok) {
    let errorBody: ApiErrorBody = { message: response.statusText || "Error de API" };
    try {
      errorBody = (await response.json()) as ApiErrorBody;
    } catch {
      // ignore invalid JSON
    }

    notifyHttpError(response.status, errorBody, auth, notifyUnauthorized);
    throw new ApiError(response.status, errorBody);
  }

  return (await response.json()) as T;
}
