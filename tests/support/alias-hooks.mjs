// Node module hooks for running the app's TypeScript in tests without a build:
// resolves the "@/..." alias to src/ and adds the .ts extension Node needs.
const SRC = new URL("../../src/", import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  const target = specifier.startsWith("@/") ? new URL(specifier.slice(2), SRC).href : specifier;
  try {
    return await nextResolve(target, context);
  } catch (error) {
    if (target.startsWith("file:") || target.startsWith(".")) {
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        try {
          return await nextResolve(target + ext, context);
        } catch {
          // try the next extension
        }
      }
    }
    throw error;
  }
}
