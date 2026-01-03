import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createGitHubClient, type GitHubClient } from "./github.js";

export interface McpServerConfig {
	githubToken?: string;
}

export function createMcpServer(config: McpServerConfig = {}) {
	const server = new McpServer(
		{ name: "mcp-github-repos", version: "1.0.0" },
		{ capabilities: { logging: {} } },
	);

	const github: GitHubClient = createGitHubClient({
		token: config.githubToken,
	});

	// Tool: search_code - Search code in a GitHub repository
	server.tool(
		"search_code",
		"Search code in a GitHub repository. Returns matching files with text fragments.",
		{
			owner: z.string().describe("Repository owner (username or organization)"),
			repo: z.string().describe("Repository name"),
			query: z
				.string()
				.describe("Search query (supports GitHub code search syntax)"),
		},
		async ({ owner, repo, query }) => {
			try {
				const result = await github.searchCode(owner, repo, query);

				const formattedResults = result.items.map((item) => {
					let text = `📄 ${item.path}`;
					if (item.textMatches && item.textMatches.length > 0) {
						text += `\n${item.textMatches.map((m) => `   > ${m.fragment}`).join("\n")}`;
					}
					return text;
				});

				return {
					content: [
						{
							type: "text",
							text: `Found ${result.totalCount} results in ${owner}/${repo}:\n\n${formattedResults.join("\n\n")}`,
						},
					],
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					content: [{ type: "text", text: `Error searching code: ${message}` }],
					isError: true,
				};
			}
		},
	);

	// Tool: get_file_content - Get the content of a file in a repository
	server.tool(
		"get_file_content",
		"Get the content of a specific file from a GitHub repository.",
		{
			owner: z.string().describe("Repository owner (username or organization)"),
			repo: z.string().describe("Repository name"),
			path: z.string().describe("File path in the repository"),
			ref: z
				.string()
				.optional()
				.describe(
					"Git reference (branch, tag, or commit SHA). Defaults to default branch.",
				),
		},
		async ({ owner, repo, path, ref }) => {
			try {
				const file = await github.getFileContent(owner, repo, path, ref);

				return {
					content: [
						{
							type: "text",
							text: `📄 ${file.path} (${file.size} bytes)\n\n\`\`\`\n${file.content}\n\`\`\``,
						},
					],
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					content: [
						{ type: "text", text: `Error getting file content: ${message}` },
					],
					isError: true,
				};
			}
		},
	);

	// Tool: list_files - List files in a repository directory
	server.tool(
		"list_files",
		"List files and directories in a GitHub repository path.",
		{
			owner: z.string().describe("Repository owner (username or organization)"),
			repo: z.string().describe("Repository name"),
			path: z
				.string()
				.optional()
				.default("")
				.describe("Directory path in the repository. Defaults to root."),
		},
		async ({ owner, repo, path }) => {
			try {
				const files = await github.listFiles(owner, repo, path);

				const formatted = files
					.sort((a, b) => {
						// Directories first, then files
						if (a.type === "dir" && b.type !== "dir") return -1;
						if (a.type !== "dir" && b.type === "dir") return 1;
						return a.name.localeCompare(b.name);
					})
					.map((f) => {
						const icon = f.type === "dir" ? "📁" : "📄";
						const size = f.type === "file" ? ` (${f.size} bytes)` : "";
						return `${icon} ${f.name}${size}`;
					});

				return {
					content: [
						{
							type: "text",
							text: `Contents of ${owner}/${repo}/${path || "(root)"}:\n\n${formatted.join("\n")}`,
						},
					],
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					content: [{ type: "text", text: `Error listing files: ${message}` }],
					isError: true,
				};
			}
		},
	);

	// Tool: get_repo_info - Get repository information
	server.tool(
		"get_repo_info",
		"Get information about a GitHub repository including description, stars, forks, etc.",
		{
			owner: z.string().describe("Repository owner (username or organization)"),
			repo: z.string().describe("Repository name"),
		},
		async ({ owner, repo }) => {
			try {
				const info = await github.getRepoInfo(owner, repo);

				const text = [
					`# ${info.fullName}`,
					"",
					info.description || "(No description)",
					"",
					`🌐 ${info.htmlUrl}`,
					`⭐ ${info.stargazersCount} stars | 🍴 ${info.forksCount} forks | 🔓 ${info.openIssuesCount} issues`,
					`🔤 Language: ${info.language || "Not specified"}`,
					`🌿 Default branch: ${info.defaultBranch}`,
					`🏷️ Topics: ${info.topics.length > 0 ? info.topics.join(", ") : "None"}`,
					"",
					`Created: ${info.createdAt}`,
					`Updated: ${info.updatedAt}`,
				].join("\n");

				return {
					content: [{ type: "text", text }],
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					content: [
						{ type: "text", text: `Error getting repo info: ${message}` },
					],
					isError: true,
				};
			}
		},
	);

	return server;
}
