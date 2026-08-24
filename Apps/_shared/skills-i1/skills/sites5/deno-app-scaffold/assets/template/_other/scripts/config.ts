/**
 * Configuration for the repository scripts in `_other/scripts`.
 *
 * These scripts deliberately do not import from `src/`, so the application's
 * own settings live in `src/config.ts`. The port lives here and nowhere else:
 * `serve.ts` passes it to the server as `PORT`, and the fallback in
 * `src/main.ts` only applies when that file is run directly.
 */

const root = decodeURIComponent(new URL("../../", import.meta.url).pathname);
const port = Number(Deno.env.get("PORT") ?? "8000");

export const config = {
  title: "{{APP_NAME}}",
  root,
  port,
  baseUrl: `http://localhost:${port}/`,
  /** Passed to the server process so it listens on exactly this port. */
  serverEnv: { PORT: String(port) },
  entrypoint: "src/main.ts",
  watchPaths: ["src/", "public/"],
  heliumPath: "/Applications/Helium.app/Contents/MacOS/Helium",
  gitOutputDirectory: "_other/git",
} as const;
