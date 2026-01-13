import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import packageJson from "../package.json" with { type: "json" };
import { createGitHubClient, parseRepository } from "./github";

export interface McpServerConfig {
	githubToken?: string;
}

export function createMcpServer(config: McpServerConfig = {}) {
	const server = new McpServer({
		name: packageJson.name,
		version: packageJson.version,
	});

	const github = createGitHubClient({ token: config.githubToken });

	// Tool: find_repo
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

	// Tool: search_code
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

	// Tool: get_file_content
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
				.describe(
					"Optional: branch, tag, or commit SHA (defaults to main branch)",
				),
		},
		async ({ repository, path, ref }) => {
			try {
				const { owner, repo } = parseRepository(repository);
				const file = await github.getFileContent(owner, repo, path, ref);

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

	// Tool: list_files
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

	// Tool: get_repo_info
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

	// Tool: get_issue
	server.tool(
		"get_issue",
		`Get detailed information about a GitHub issue, including its full timeline of events.

WHEN TO USE:
- Need to understand the full history of an issue
- Want to see comments, label changes, assignments, and other events
- Looking for context about how an issue evolved

OUTPUT: Returns issue details with a chronological timeline including:
- Comments with full body text
- Label additions/removals
- Assignee changes
- Milestone changes
- Cross-references from other issues/PRs
- Commits that reference the issue

EXAMPLES:
- repository: "vercel/ai", issue_number: 123 → gets full issue timeline`,
		{
			repository: z
				.string()
				.describe('Repository in "owner/repo" format (e.g., "vercel/ai")'),
			issue_number: z.number().describe("The issue number to retrieve"),
		},
		async ({ repository, issue_number }) => {
			try {
				const { owner, repo } = parseRepository(repository);
				const issue = await github.getIssue(owner, repo, issue_number);

				const formatDate = (date: string) => {
					return new Date(date).toLocaleString("en-US", {
						year: "numeric",
						month: "short",
						day: "numeric",
						hour: "2-digit",
						minute: "2-digit",
					});
				};

				const header = [
					`# #${issue.number}: ${issue.title}`,
					"",
					`**State:** ${issue.state === "open" ? "🟢 Open" : "🔴 Closed"}`,
					`**Author:** @${issue.user.login}`,
					`**Created:** ${formatDate(issue.createdAt)}`,
					`**Updated:** ${formatDate(issue.updatedAt)}`,
					issue.closedAt ? `**Closed:** ${formatDate(issue.closedAt)}` : null,
					"",
					issue.labels.length > 0
						? `**Labels:** ${issue.labels.map((l) => `\`${l.name}\``).join(", ")}`
						: null,
					issue.assignees.length > 0
						? `**Assignees:** ${issue.assignees.map((a) => `@${a.login}`).join(", ")}`
						: null,
					issue.milestone ? `**Milestone:** ${issue.milestone.title}` : null,
					"",
					`🔗 ${issue.htmlUrl}`,
				]
					.filter(Boolean)
					.join("\n");

				const body = issue.body
					? `\n---\n\n## Description\n\n${issue.body}`
					: "";

				const timelineItems = issue.timeline
					.filter((event) => event.createdAt)
					.map((event) => {
						const time = formatDate(event.createdAt);
						const actor = event.actor ? `@${event.actor.login}` : "someone";

						switch (event.type) {
							case "commented":
								return `### 💬 ${actor} commented on ${time}\n\n${event.body || "(empty comment)"}`;
							case "labeled":
								return `🏷️ ${actor} added label \`${event.label?.name}\` on ${time}`;
							case "unlabeled":
								return `🏷️ ${actor} removed label \`${event.label?.name}\` on ${time}`;
							case "assigned":
								return `👤 ${actor} assigned @${event.assignee?.login} on ${time}`;
							case "unassigned":
								return `👤 ${actor} unassigned @${event.assignee?.login} on ${time}`;
							case "milestoned":
								return `🎯 ${actor} added to milestone "${event.milestone?.title}" on ${time}`;
							case "demilestoned":
								return `🎯 ${actor} removed from milestone "${event.milestone?.title}" on ${time}`;
							case "renamed":
								return `✏️ ${actor} changed title from "${event.rename?.from}" to "${event.rename?.to}" on ${time}`;
							case "closed":
								return `🔴 ${actor} closed this issue on ${time}`;
							case "reopened":
								return `🟢 ${actor} reopened this issue on ${time}`;
							case "cross-referenced":
								return `🔗 Referenced in #${event.source?.issue?.number}: ${event.source?.issue?.title} on ${time}`;
							case "referenced":
								return `📝 ${actor} referenced this in commit \`${event.commitId?.slice(0, 7)}\` on ${time}`;
							case "committed":
								return `📝 Commit \`${event.commitId?.slice(0, 7)}\` on ${time}`;
							default:
								return `📋 ${event.type} by ${actor} on ${time}`;
						}
					});

				const timeline =
					timelineItems.length > 0
						? `\n---\n\n## Timeline\n\n${timelineItems.join("\n\n")}`
						: "";

				return {
					content: [
						{
							type: "text",
							text: `${header}${body}${timeline}`,
						},
					],
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					content: [{ type: "text", text: `Error getting issue: ${message}` }],
					isError: true,
				};
			}
		},
	);

	// Tool: get_pull_request
	server.tool(
		"get_pull_request",
		`Get detailed information about a GitHub pull request, including diff and reviews.

WHEN TO USE:
- Need to review the changes in a pull request
- Want to see the diff of what was changed
- Looking for review comments and discussions
- Understanding the full PR timeline

OUTPUT: Returns PR details with:
- Full diff showing all file changes
- Review comments with code context
- Timeline of events (comments, approvals, changes requested)
- Merge status and commit information

EXAMPLES:
- repository: "vercel/ai", pull_number: 456 → gets full PR with diff and reviews`,
		{
			repository: z
				.string()
				.describe('Repository in "owner/repo" format (e.g., "vercel/ai")'),
			pull_number: z.number().describe("The pull request number to retrieve"),
		},
		async ({ repository, pull_number }) => {
			try {
				const { owner, repo } = parseRepository(repository);
				const pr = await github.getPullRequest(owner, repo, pull_number);

				const formatDate = (date: string) => {
					return new Date(date).toLocaleString("en-US", {
						year: "numeric",
						month: "short",
						day: "numeric",
						hour: "2-digit",
						minute: "2-digit",
					});
				};

				const stateIcon =
					pr.state === "open"
						? pr.draft
							? "📝 Draft"
							: "🟢 Open"
						: pr.mergedAt
							? "🟣 Merged"
							: "🔴 Closed";

				const header = [
					`# #${pr.number}: ${pr.title}`,
					"",
					`**State:** ${stateIcon}`,
					`**Author:** @${pr.user.login}`,
					`**Branch:** \`${pr.head.ref}\` → \`${pr.base.ref}\``,
					`**Created:** ${formatDate(pr.createdAt)}`,
					`**Updated:** ${formatDate(pr.updatedAt)}`,
					pr.mergedAt ? `**Merged:** ${formatDate(pr.mergedAt)}` : null,
					pr.closedAt && !pr.mergedAt
						? `**Closed:** ${formatDate(pr.closedAt)}`
						: null,
					"",
					`**Changes:** +${pr.additions} -${pr.deletions} in ${pr.changedFiles} files`,
					`**Commits:** ${pr.commitsCount} | **Comments:** ${pr.commentsCount} | **Review comments:** ${pr.reviewCommentsCount}`,
					"",
					pr.labels.length > 0
						? `**Labels:** ${pr.labels.map((l) => `\`${l.name}\``).join(", ")}`
						: null,
					pr.assignees.length > 0
						? `**Assignees:** ${pr.assignees.map((a) => `@${a.login}`).join(", ")}`
						: null,
					pr.milestone ? `**Milestone:** ${pr.milestone.title}` : null,
					"",
					`🔗 ${pr.htmlUrl}`,
				]
					.filter(Boolean)
					.join("\n");

				const body = pr.body ? `\n---\n\n## Description\n\n${pr.body}` : "";

				const reviewsSection =
					pr.reviews.length > 0
						? `\n---\n\n## Reviews\n\n${pr.reviews
								.map((review) => {
									const stateEmoji =
										{
											APPROVED: "✅",
											CHANGES_REQUESTED: "❌",
											COMMENTED: "💬",
											DISMISSED: "🚫",
											PENDING: "⏳",
										}[review.state] || "📋";

									const reviewHeader = `### ${stateEmoji} @${review.user.login} - ${review.state}${review.submittedAt ? ` on ${formatDate(review.submittedAt)}` : ""}`;
									const reviewBody = review.body ? `\n\n${review.body}` : "";
									const reviewComments =
										review.comments.length > 0
											? `\n\n**Review comments:**\n${review.comments
													.map(
														(c) =>
															`- **${c.path}${c.line ? `:${c.line}` : ""}**: ${c.body}`,
													)
													.join("\n")}`
											: "";

									return `${reviewHeader}${reviewBody}${reviewComments}`;
								})
								.join("\n\n")}`
						: "";

				const diff = `\n---\n\n## Diff\n\n\`\`\`diff\n${pr.diff}\n\`\`\``;

				return {
					content: [
						{
							type: "text",
							text: `${header}${body}${reviewsSection}${diff}`,
						},
					],
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					content: [
						{ type: "text", text: `Error getting pull request: ${message}` },
					],
					isError: true,
				};
			}
		},
	);

	return server;
}
