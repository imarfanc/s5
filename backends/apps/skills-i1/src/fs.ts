/** Small local equivalents of the std/fs helpers used by the source app. */
export async function exists(path: string): Promise<boolean> {
  try {
    await Deno.lstat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

export async function ensureDir(path: string): Promise<void> {
  await Deno.mkdir(path, { recursive: true });
}

export async function copy(source: string, destination: string): Promise<void> {
  const info = await Deno.lstat(source);
  if (info.isDirectory) {
    await ensureDir(destination);
    for await (const entry of Deno.readDir(source)) {
      await copy(`${source}/${entry.name}`, `${destination}/${entry.name}`);
    }
    return;
  }
  if (info.isSymlink) {
    await Deno.symlink(await Deno.readLink(source), destination);
    return;
  }
  await Deno.copyFile(source, destination);
}
