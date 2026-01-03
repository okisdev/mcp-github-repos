import { Octokit } from "@octokit/rest";

export interface GitHubConfig {
	token?: string;
}

export interface SearchCodeResult {
	totalCount: number;
	items: Array<{
		name: string;
		path: string;
		sha: string;
		url: string;
		htmlUrl: string;
		repository: {
			fullName: string;
		};
		textMatches?: Array<{
			fragment: string;
			matches: Array<{
				text: string;
				indices: [number, number];
			}>;
		}>;
	}>;
}

export interface FileContent {
	name: string;
	path: string;
	sha: string;
	size: number;
	content: string;
	encoding: string;
}

export interface RepoFile {
	name: string;
	path: string;
	sha: string;
	size: number;
	type: "file" | "dir" | "symlink" | "submodule";
	url: string;
	htmlUrl: string;
}

export interface RepoInfo {
	id: number;
	name: string;
	fullName: string;
	description: string | null;
	private: boolean;
	htmlUrl: string;
	language: string | null;
	defaultBranch: string;
	stargazersCount: number;
	forksCount: number;
	openIssuesCount: number;
	topics: string[];
	createdAt: string | null;
	updatedAt: string | null;
}

export function createGitHubClient(config: GitHubConfig = {}) {
	const octokit = new Octokit({
		auth: config.token || undefined,
	});

	return {
		async searchCode(
			owner: string,
			repo: string,
			query: string,
		): Promise<SearchCodeResult> {
			const response = await octokit.search.code({
				q: `${query} repo:${owner}/${repo}`,
				per_page: 30,
				headers: {
					accept: "application/vnd.github.text-match+json",
				},
			});

			return {
				totalCount: response.data.total_count,
				items: response.data.items.map((item) => ({
					name: item.name,
					path: item.path,
					sha: item.sha,
					url: item.url,
					htmlUrl: item.html_url,
					repository: {
						fullName: item.repository.full_name,
					},
					textMatches: item.text_matches?.map((match) => ({
						fragment: match.fragment ?? "",
						matches:
							match.matches?.map((m) => ({
								text: m.text ?? "",
								indices: m.indices as [number, number],
							})) ?? [],
					})),
				})),
			};
		},

		async getFileContent(
			owner: string,
			repo: string,
			path: string,
			ref?: string,
		): Promise<FileContent> {
			const response = await octokit.repos.getContent({
				owner,
				repo,
				path,
				ref,
			});

			const data = response.data;

			if (Array.isArray(data)) {
				throw new Error(`Path "${path}" is a directory, not a file`);
			}

			if (data.type !== "file") {
				throw new Error(`Path "${path}" is not a file (type: ${data.type})`);
			}

			return {
				name: data.name,
				path: data.path,
				sha: data.sha,
				size: data.size,
				content: Buffer.from(data.content, "base64").toString("utf-8"),
				encoding: data.encoding,
			};
		},

		async listFiles(
			owner: string,
			repo: string,
			path: string = "",
		): Promise<RepoFile[]> {
			const response = await octokit.repos.getContent({
				owner,
				repo,
				path,
			});

			const data = response.data;

			if (!Array.isArray(data)) {
				throw new Error(`Path "${path}" is a file, not a directory`);
			}

			return data.map((item) => ({
				name: item.name,
				path: item.path,
				sha: item.sha,
				size: item.size ?? 0,
				type: item.type as RepoFile["type"],
				url: item.url,
				htmlUrl: item.html_url ?? "",
			}));
		},

		async getRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
			const response = await octokit.repos.get({
				owner,
				repo,
			});

			const data = response.data;

			return {
				id: data.id,
				name: data.name,
				fullName: data.full_name,
				description: data.description,
				private: data.private,
				htmlUrl: data.html_url,
				language: data.language,
				defaultBranch: data.default_branch,
				stargazersCount: data.stargazers_count,
				forksCount: data.forks_count,
				openIssuesCount: data.open_issues_count,
				topics: data.topics ?? [],
				createdAt: data.created_at,
				updatedAt: data.updated_at,
			};
		},
	};
}

export type GitHubClient = ReturnType<typeof createGitHubClient>;
