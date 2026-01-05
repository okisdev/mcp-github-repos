import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		serve: "src/serve.ts",
	},
	format: ["esm"],
	dts: true,
	sourcemap: true,
	clean: true,
	target: "node20",
	external: ["@modelcontextprotocol/sdk"],
});
