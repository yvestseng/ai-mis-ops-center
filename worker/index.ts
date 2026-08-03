/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { handleSurveyRequest } from "./surveys";
import { handleTicketRequest } from "./tickets";
import { handleAdminRequest, handleSessionRequest } from "./admin";
import { handleDashboardRequest } from "./dashboard";
import { handleSupportTeamRequest } from "./support-teams";
import { handleChangePasswordRequest, handleLoginRequest, handleLogoutRequest } from "./auth";
import { securityHeaders, validateApiRequest } from "./security";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  AUTH_ALLOW_DEMO?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    try {
    const rejected = await validateApiRequest(request);
    if (rejected) return securityHeaders(request, rejected);

    const respond = async (value: Response | Promise<Response>) =>
      securityHeaders(request, await value);

    if (url.pathname === "/api/surveys") {
      return respond(handleSurveyRequest(request, env.DB));
    }

    if (url.pathname === "/api/tickets") {
      return respond(handleTicketRequest(request, env.DB));
    }

    const ticketMatch = url.pathname.match(/^\/api\/tickets\/([^/]+)$/);
    if (ticketMatch) {
      return respond(handleTicketRequest(request, env.DB, ticketMatch[1]));
    }



    if (url.pathname === "/api/support-teams") {
      return respond(handleSupportTeamRequest(request, env.DB));
    }

    const supportTeamMatch = url.pathname.match(/^\/api\/support-teams\/([^/]+)\/members$/);
    if (supportTeamMatch) {
      return respond(handleSupportTeamRequest(request, env.DB, supportTeamMatch[1]));
    }

    if (url.pathname === "/api/session") {
      return respond(handleSessionRequest(request, env.DB));
    }

    if (url.pathname === "/api/auth/login") {
      return respond(handleLoginRequest(request, env.DB, env.AUTH_ALLOW_DEMO === "true"));
    }

    if (url.pathname === "/api/auth/logout") {
      return respond(handleLogoutRequest(request, env.DB));
    }

    if (url.pathname === "/api/auth/change-password") {
      return respond(handleChangePasswordRequest(request, env.DB));
    }

    if (url.pathname === "/api/dashboard") {
      return respond(handleDashboardRequest(request, env.DB));
    }

    const adminMatch = url.pathname.match(
      /^\/api\/admin\/(users|roles|teams|assets|services|audit)(?:\/([^/]+))?$/,
    );
    if (adminMatch) {
      return respond(handleAdminRequest(
        request,
        env.DB,
        adminMatch[1] as "users" | "roles" | "teams" | "assets" | "services" | "audit",
        adminMatch[2],
      ));
    }

    if (url.pathname.startsWith("/api/")) {
      return respond(Response.json(
        { error: "API_NOT_FOUND", message: "找不到指定的 API。" },
        { status: 404 },
      ));
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return respond(handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths));
    }

      return respond(handler.fetch(request, env, ctx));
    } catch (error) {
      console.error("Unhandled worker error", error);
      const response = url.pathname.startsWith("/api/")
        ? Response.json(
            { error: "INTERNAL_ERROR", message: "系統暫時無法處理此要求，請稍後再試。" },
            { status: 500 },
          )
        : new Response("系統暫時無法使用，請稍後重新整理。", {
            status: 500,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
      return securityHeaders(request, response);
    }
  },
};

export default worker;
