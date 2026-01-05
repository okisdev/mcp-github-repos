import { Hono } from "hono";
import { cors } from "hono/cors";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { toFetchResponse, toReqRes } from "fetch-to-node";
import { createMcpServer } from "./mcp-server.js";

const app = new Hono();

// Enable CORS for MCP clients
app.use("*", cors());

// Health check endpoint
app.get("/", (c) => {
	return c.json({
		name: "mcp-github-repos",
		version: "1.0.0",
		description: "MCP server for searching GitHub repositories",
		transport: "Streamable HTTP (stateless)",
		endpoint: "POST /mcp",
		tools: [
			"find_repo - Search for repositories by name or keywords",
			"search_code - Search code in a repository (owner/repo format)",
			"get_file_content - Get file content with syntax highlighting",
			"list_files - List files in a directory",
			"get_repo_info - Get repository information",
		],
	});
});

// Streamable HTTP endpoint (stateless, works with serverless)
app.post("/mcp", async (c) => {
	const { req, res } = toReqRes(c.req.raw);

	// Get GitHub token from header or environment (optional)
	const githubToken =
		c.req.header("X-GitHub-Token") || process.env.GITHUB_TOKEN || undefined;

	const server = createMcpServer({ githubToken });

	try {
		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined, // Stateless mode
		});

		await server.connect(transport);
		await transport.handleRequest(req, res, await c.req.json());

		res.on("close", () => {
			transport.close();
			server.close();
		});

		return toFetchResponse(res);
	} catch (error) {
		console.error("MCP request error:", error);
		return c.json(
			{
				jsonrpc: "2.0",
				error: {
					code: -32603,
					message:
						error instanceof Error ? error.message : "Internal server error",
				},
				id: null,
			},
			{ status: 500 },
		);
	}
});

// Handle GET /mcp for initialization (required by MCP protocol)
app.get("/mcp", (c) => {
	return c.json(
		{
			jsonrpc: "2.0",
			error: {
				code: -32000,
				message: "Use POST method for MCP requests",
			},
			id: null,
		},
		{ status: 405 },
	);
});

// Handle DELETE /mcp for session cleanup (required by MCP protocol)
app.delete("/mcp", (_c) => {
	// Stateless server - nothing to clean up
	return new Response(null, { status: 204 });
});

export default app;
