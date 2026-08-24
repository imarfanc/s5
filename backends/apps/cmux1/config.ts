/** Public and process settings for the standalone terminal app backend. */
export const clientConfig = {
  title: "cmux1",
  host: Deno.hostname(),
};

export const config = {
  ...clientConfig,
  /** Each terminal starts this login shell. */
  shell: Deno.env.get("SHELL") ?? "/bin/bash",
};
