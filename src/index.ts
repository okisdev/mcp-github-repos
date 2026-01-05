import { Hono } from "hono";
import { cors } from "hono/cors";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "./mcp-server.js";
import packageJson from "../package.json" with { type: "json" };

const app = new Hono();

// Enable CORS for MCP clients
app.use("*", cors());

// Health check endpoint
app.get("/", (c) => {
	return c.json({
		name: packageJson.name,
		version: packageJson.version,
		description: packageJson.description,
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
	// Get GitHub token from header or environment (optional)
	const githubToken =
		c.req.header("X-GitHub-Token") || process.env.GITHUB_TOKEN || undefined;

	const server = createMcpServer({ githubToken });

	try {
		const transport = new WebStandardStreamableHTTPServerTransport({
			sessionIdGenerator: undefined, // Stateless mode
		});

		await server.connect(transport);

		const response = await transport.handleRequest(c.req.raw, {
			parsedBody: await c.req.json(),
		});

		// Clean up when the response is done
		if (response.body) {
			const originalBody = response.body;
			const reader = originalBody.getReader();
			const stream = new ReadableStream({
				async start(controller) {
					try {
						while (true) {
							const { done, value } = await reader.read();
							if (done) break;
							controller.enqueue(value);
						}
						controller.close();
					} finally {
						await transport.close();
						await server.close();
					}
				},
			});
			return new Response(stream, {
				status: response.status,
				headers: response.headers,
			});
		}

		await transport.close();
		await server.close();
		return response;
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
