import app from "../apps/api/src/app.js";

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.searchParams.get("path") ?? "v1";
    const destination = new URL(`/api/${path}`, url.origin);

    for (const [key, value] of url.searchParams) {
      if (key !== "path") {
        destination.searchParams.append(key, value);
      }
    }

    return app.fetch(new Request(destination, request));
  },
};
