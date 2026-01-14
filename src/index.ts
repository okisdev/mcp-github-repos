import { StreamableHTTPTransport } from "@hono/mcp";
import { Hono } from "hono";
import { cors } from "hono/cors";
import packageJson from "../package.json" with { type: "json" };
import { createMcpServer } from "./mcp-server";

type Bindings = {
	GITHUB_TOKEN?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors());

app.get("/", (c) => {
	return c.json({
		name: packageJson.name,
		version: packageJson.version,
		description: packageJson.description,
		endpoints: {
			mcp: "/mcp",
			health: "/",
		},
		tools: [
			"find_repo - Search for repositories by name or keywords",
			"search_code - Search code in a repository (owner/repo format)",
			"get_file_content - Get file content with syntax highlighting",
			"list_files - List files in a directory",
			"get_repo_info - Get repository information",
			"get_issue - Get issue details with timeline (comments, labels, events)",
			"get_pull_request - Get PR details with diff and reviews",
			"get_commit - Get commit details with diff",
		],
	});
});

app.all("/mcp", async (c) => {
	const githubToken = c.req.header("X-GitHub-Token") || c.env.GITHUB_TOKEN;
	const server = createMcpServer({ githubToken });

	const transport = new StreamableHTTPTransport();
	await server.connect(transport);

	return transport.handleRequest(c);
});

export default app;
