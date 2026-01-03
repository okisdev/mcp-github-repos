import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
	createGitHubClient,
	parseRepository,
	type GitHubClient,
} from "./github.js";

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

	// Tool: find_repo - Search for repositories
	server.tool(
		"find_repo",
		`Search GitHub to find the correct repository name.

WHEN TO USE:
- User mentions a project name but not the exact "owner/repo" (e.g., "ai-sdk", "nextjs", "shadcn ui")
- You need to discover the correct repository identifier before using other tools

EXAMPLES:
- "ai-sdk" → finds "vercel/ai"
- "react" → finds "facebook/react"
- "nextjs" → finds "vercel/next.js"

OUTPUT: Returns top repositories with full names (owner/repo format) that you can use with other tools.`,
		{
			query: z
				.string()
				.describe(
					"Project name or keywords to search (e.g., 'ai-sdk', 'react query', 'nextjs')",
				),
		},
		async ({ query }) => {
			try {
				const result = await github.searchRepos(query);

				if (result.items.length === 0) {
					return {
						content: [
							{
								type: "text",
								text: `No repositories found for "${query}". Try different keywords.`,
							},
						],
					};
				}

				const formatted = result.items.map((repo, index) => {
					const lines = [
						`${index + 1}. **${repo.fullName}** ⭐ ${repo.stargazersCount}`,
						`   ${repo.description || "(No description)"}`,
						`   Language: ${repo.language || "N/A"} | Forks: ${repo.forksCount}`,
						`   ${repo.htmlUrl}`,
					];
					if (repo.topics.length > 0) {
						lines.push(`   Topics: ${repo.topics.slice(0, 5).join(", ")}`);
					}
					return lines.join("\n");
				});

				return {
					content: [
						{
							type: "text",
							text: `Found ${result.totalCount} repositories for "${query}":\n\n${formatted.join("\n\n")}\n\n💡 Use the "owner/repo" format (e.g., "${result.items[0]?.fullName}") with other tools.`,
						},
					],
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					content: [
						{ type: "text", text: `Error searching repositories: ${message}` },
					],
					isError: true,
				};
			}
		},
	);

	// Tool: search_code - Search code in a GitHub repository
	server.tool(
		"search_code",
		`Search for code (functions, classes, keywords) within a specific GitHub repository.

WHEN TO USE:
- User asks about specific functionality in a known repository
- Looking for implementation details, function definitions, or usage examples
- Need to find where something is defined or used in the codebase

REQUIRED: repository must be in "owner/repo" format. If you only have a project name, use find_repo first.

WORKFLOW:
1. If user says "search ai-sdk for useChat" → first call find_repo("ai-sdk") to get "vercel/ai"
2. Then call search_code with repository="vercel/ai", query="useChat"

EXAMPLES:
- repository: "vercel/ai", query: "useChat" → finds useChat hook implementation
- repository: "facebook/react", query: "useState" → finds useState source code`,
		{
			repository: z
				.string()
				.describe(
					'REQUIRED: Repository in "owner/repo" format. Examples: "vercel/ai", "facebook/react", "microsoft/vscode"',
				),
			query: z
				.string()
				.describe(
					"Code to search for: function names, class names, keywords, or patterns",
				),
		},
		async ({ repository, query }) => {
			try {
				const { owner, repo } = parseRepository(repository);
				const result = await github.searchCode(owner, repo, query);

				if (result.items.length === 0) {
					return {
						content: [
							{
								type: "text",
								text: `No code found for "${query}" in ${repository}. Try different keywords or check if the repository name is correct.`,
							},
						],
					};
				}

				const formattedResults = result.items.map((item) => {
					let text = `📄 **${item.path}**`;
					if (item.textMatches && item.textMatches.length > 0) {
						text += `\n${item.textMatches.map((m) => `\`\`\`\n${m.fragment}\n\`\`\``).join("\n")}`;
					}
					return text;
				});

				return {
					content: [
						{
							type: "text",
							text: `Found ${result.totalCount} results for "${query}" in ${repository}:\n\n${formattedResults.join("\n\n")}\n\n💡 Use get_file_content to read the full source code of any file.`,
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
		`Read the complete source code of a specific file from a GitHub repository.

WHEN TO USE:
- After search_code found relevant files, read the full implementation
- Need to understand complete function/class implementation
- Want to see imports, exports, or full context of a code snippet

REQUIRES: You must know the exact file path. Use search_code or list_files first if unsure.

EXAMPLES:
- repository: "vercel/ai", path: "packages/react/src/use-chat.ts"
- repository: "facebook/react", path: "packages/react/src/ReactHooks.js"`,
		{
			repository: z
				.string()
				.describe('Repository in "owner/repo" format (e.g., "vercel/ai")'),
			path: z
				.string()
				.describe(
					"Exact file path from repository root (e.g., 'src/index.ts', 'packages/core/lib/main.js')",
				),
			ref: z
				.string()
				.optional()
				.describe("Optional: branch, tag, or commit SHA (defaults to main branch)"),
		},
		async ({ repository, path, ref }) => {
			try {
				const { owner, repo } = parseRepository(repository);
				const file = await github.getFileContent(owner, repo, path, ref);

				// Detect language from file extension for syntax highlighting
				const ext = path.split(".").pop() || "";
				const langMap: Record<string, string> = {
					ts: "typescript",
					tsx: "tsx",
					js: "javascript",
					jsx: "jsx",
					py: "python",
					rs: "rust",
					go: "go",
					md: "markdown",
					json: "json",
					yaml: "yaml",
					yml: "yaml",
				};
				const lang = langMap[ext] || ext;

				return {
					content: [
						{
							type: "text",
							text: `📄 **${file.path}** (${file.size} bytes)\n\n\`\`\`${lang}\n${file.content}\n\`\`\``,
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
		`List all files and folders in a repository directory. Use this to explore and understand project structure.

WHEN TO USE:
- Need to understand repository structure before searching
- Looking for specific file types (e.g., config files, source directories)
- Don't know exact file paths

EXAMPLES:
- repository: "vercel/ai", path: "" → shows root directory (src/, packages/, README.md, etc.)
- repository: "vercel/ai", path: "packages/react/src" → shows files in that folder`,
		{
			repository: z
				.string()
				.describe('Repository in "owner/repo" format (e.g., "vercel/ai")'),
			path: z
				.string()
				.optional()
				.default("")
				.describe(
					"Directory path to list. Leave empty or use '' for root directory.",
				),
		},
		async ({ repository, path }) => {
			try {
				const { owner, repo } = parseRepository(repository);
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
							text: `Contents of **${repository}/${path || "(root)"}**:\n\n${formatted.join("\n")}`,
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
		`Get metadata about a GitHub repository: description, stars, forks, language, topics, etc.

WHEN TO USE:
- Need to verify a repository exists and is the right one
- Want to understand what a project is about
- Looking for project metadata (language, topics, activity)

This is a lightweight call - use it to quickly check repository details.`,
		{
			repository: z
				.string()
				.describe('Repository in "owner/repo" format (e.g., "vercel/ai")'),
		},
		async ({ repository }) => {
			try {
				const { owner, repo } = parseRepository(repository);
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
