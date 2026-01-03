import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts", "src/serve.ts"],
	format: ["esm"],
	dts: true,
	sourcemap: true,
	clean: true,
	target: "node20",
	external: ["@modelcontextprotocol/sdk"],
});
