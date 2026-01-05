import { serve } from "@hono/node-server";
import app from "./index.js";

const port = Number(process.env.PORT) || 3000;

console.log(`🚀 MCP GitHub Repos server running at http://localhost:${port}`);
console.log(`   POST /mcp - MCP endpoint (Streamable HTTP, stateless)`);
console.log(`   GET  /    - Health check`);

if (process.env.GITHUB_TOKEN) {
	console.log(`   ✅ GITHUB_TOKEN configured`);
} else {
	console.log(
		`   ⚠️  GITHUB_TOKEN not set (using anonymous access with rate limits)`,
	);
}

serve({
	fetch: app.fetch,
	port,
});
