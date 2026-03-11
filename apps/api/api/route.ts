import bundledApp from "../dist/app.cjs";

const app = (bundledApp as { default?: { fetch: typeof fetch } }).default ?? bundledApp;

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.searchParams.get("path") ?? "";
    const destination = new URL(`/api/${path}`, url.origin);

    for (const [key, value] of url.searchParams) {
      if (key !== "path") {
        destination.searchParams.append(key, value);
      }
    }

    return app.fetch(new Request(destination, request));
  },
};
