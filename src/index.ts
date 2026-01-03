import { Hono } from "hono";
import { cors } from "hono/cors";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { toFetchResponse, toReqRes } from "fetch-to-node";
import { createMcpServer } from "./mcp-server.js";

const app = new Hono();

// Enable CORS for MCP clients
app.use("*", cors());

// Store SSE transports by session ID for the legacy SSE transport
const sseTransports = new Map<string, SSEServerTransport>();

// Health check endpoint
app.get("/", (c) => {
	return c.json({
		name: "mcp-github-repos",
		version: "1.0.0",
		description: "MCP server for searching GitHub repositories",
		endpoints: {
			mcp: "POST /mcp",
			sse: "GET /sse",
			messages: "POST /messages",
			health: "GET /",
		},
		tools: [
			"find_repo - Search for repositories by name or keywords",
			"search_code - Search code in a repository (owner/repo format)",
			"get_file_content - Get file content with syntax highlighting",
			"list_files - List files in a directory",
			"get_repo_info - Get repository information",
		],
	});
});

// Streamable HTTP endpoint (recommended)
app.post("/mcp", async (c) => {
	const { req, res } = toReqRes(c.req.raw);

	// Get GitHub token from header or environment (optional)
	const githubToken =
		c.req.header("X-GitHub-Token") || process.env.GITHUB_TOKEN || undefined;

	const server = createMcpServer({ githubToken });

	try {
		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
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

// SSE endpoint - establishes SSE connection (legacy transport for backwards compatibility)
app.get("/sse", async (c) => {
	const { res } = toReqRes(c.req.raw);

	// Get GitHub token from header or environment (optional)
	const githubToken =
		c.req.header("X-GitHub-Token") || process.env.GITHUB_TOKEN || undefined;

	const server = createMcpServer({ githubToken });

	try {
		const transport = new SSEServerTransport("/messages", res);
		const sessionId = transport.sessionId;

		sseTransports.set(sessionId, transport);

		res.on("close", () => {
			sseTransports.delete(sessionId);
			transport.close();
			server.close();
		});

		await server.connect(transport);

		return toFetchResponse(res);
	} catch (error) {
		console.error("SSE connection error:", error);
		return c.json(
			{
				error: error instanceof Error ? error.message : "SSE connection failed",
			},
			{ status: 500 },
		);
	}
});

// Messages endpoint - receives client messages for SSE transport
app.post("/messages", async (c) => {
	const sessionId = c.req.query("sessionId");

	if (!sessionId) {
		return c.json(
			{ error: "Missing sessionId query parameter" },
			{ status: 400 },
		);
	}

	const transport = sseTransports.get(sessionId);

	if (!transport) {
		return c.json(
			{ error: "No active SSE connection for this session" },
			{ status: 404 },
		);
	}

	const { req, res } = toReqRes(c.req.raw);

	try {
		const body = await c.req.json();
		await transport.handlePostMessage(req, res, body);
		return toFetchResponse(res);
	} catch (error) {
		console.error("Message handling error:", error);
		return c.json(
			{
				error:
					error instanceof Error ? error.message : "Message handling failed",
			},
			{ status: 500 },
		);
	}
});

export default app;
