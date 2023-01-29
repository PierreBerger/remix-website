import { redirect } from "@remix-run/node";
import fs from "fs/promises";
import path from "path";

export function requirePost(request: Request) {
  if (request.method.toLowerCase() !== "post") {
    throw new Response("", {
      status: 405,
      statusText: "Method Not Allowed",
    });
  }
}

// relative to where we're built, build/index.js
type Redirect = [string, string, number?];
let redirects: null | Redirect[] = null;

// TODO: add support with pathToRegexp to redirect with * and stuff
export async function handleRedirects(request: Request) {
  if (redirects === null) {
    let filePath = path.join(__dirname, "..", "_redirects");
    redirects = (await fs.readFile(filePath))
      .toString()
      .split("\n")
      .reduce((redirects, line: string) => {
        if (line.startsWith("#") || line.trim() === "") {
          return redirects;
        }

        let code = 302;
        let [from, to, maybeCode] = line.split(/\s+/);
        if (maybeCode) {
          code = parseInt(maybeCode, 10);
        }
        redirects.push([from, to, code]);

        return redirects;
      }, [] as Redirect[]);
  }

  for (let r of redirects) {
    let [from, location, status] = r;
    let url = new URL(request.url);
    if (url.pathname === from) {
      throw redirect(location, { status });
    }
  }
  return null;
}

export function safeRedirect(
  to: FormDataEntryValue | string | null | undefined,
  init?: number | ResponseInit
) {
  if (
    !to ||
    typeof to !== "string" ||
    !to.startsWith("/") ||
    to.startsWith("//")
  ) {
    to = "/";
  }
  return redirect(to, init);
}

export async function removeTrailingSlashes(request: Request) {
  let url = new URL(request.url);
  if (url.pathname.endsWith("/") && url.pathname !== "/") {
    throw redirect(url.pathname.slice(0, -1) + url.search);
  }
}

export async function ensureSecure(request: Request) {
  let proto = request.headers.get("x-forwarded-proto");
  if (proto === "http") {
    let secureUrl = new URL(request.url);
    secureUrl.protocol = "https:";
    throw redirect(secureUrl.toString());
  }
}

export function isProductionHost(request: Request) {
  return "remix.run" === request.headers.get("host");
}

export const CACHE_CONTROL = {
  // Add 5 minutes cache control to documents and json requests to speed up the
  // back button
  DEFAULT: "max-age=300",
  /**
   * Keep it in the browser (and CDN) for 5 minutes so when they click
   * back/forward/etc.  It's super fast, swr for 1 week on CDN so it stays fast
   * but people get typos fixes and stuff, too.
   */
  doc: "max-age=300, stale-while-revalidate=604800",
};
