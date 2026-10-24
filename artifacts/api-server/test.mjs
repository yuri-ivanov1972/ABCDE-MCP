import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const directory = await mkdtemp(join(tmpdir(), "abcde-mcp-tests-"));
try {
  const output = join(directory, "tests.cjs");
  await build({
    entryPoints: ["src/lib/mcp/all-tests.ts"],
    outfile: output,
    bundle: true,
    platform: "node",
    format: "cjs",
    logLevel: "warning",
  });
  const result = spawnSync(process.execPath, ["--test", output], {
    stdio: "inherit",
    env: process.env,
  });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
