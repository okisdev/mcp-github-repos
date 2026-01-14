import { Octokit } from "@octokit/rest";
import { parseLabels, parseTimelineEvents, parseUser } from "./utils";

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

export interface SearchReposResult {
	totalCount: number;
	items: Array<{
		id: number;
		fullName: string;
		description: string | null;
		htmlUrl: string;
		language: string | null;
		stargazersCount: number;
		forksCount: number;
		topics: string[];
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

export interface IssueUser {
	login: string;
	htmlUrl: string;
}

export interface IssueLabel {
	name: string;
	color: string;
	description: string | null;
}

export interface IssueTimelineEvent {
	type: string;
	createdAt: string;
	actor?: IssueUser;
	body?: string;
	label?: IssueLabel;
	assignee?: IssueUser;
	milestone?: { title: string };
	rename?: { from: string; to: string };
	source?: { issue: { number: number; title: string } };
	commitId?: string;
	commitUrl?: string;
}

export interface IssueInfo {
	number: number;
	title: string;
	state: string;
	body: string | null;
	user: IssueUser;
	labels: IssueLabel[];
	assignees: IssueUser[];
	milestone: { title: string; state: string } | null;
	createdAt: string;
	updatedAt: string;
	closedAt: string | null;
	htmlUrl: string;
	commentsCount: number;
	timeline: IssueTimelineEvent[];
}

export interface PullRequestReviewComment {
	id: number;
	path: string;
	line: number | null;
	body: string;
	user: IssueUser;
	createdAt: string;
	diffHunk: string;
}

export interface PullRequestReview {
	id: number;
	user: IssueUser;
	body: string | null;
	state: string;
	submittedAt: string | null;
	comments: PullRequestReviewComment[];
}

export interface CommitInfo {
	sha: string;
	message: string;
	author: {
		name: string;
		email: string;
		date: string;
	} | null;
	committer: {
		name: string;
		email: string;
		date: string;
	} | null;
	user: IssueUser | null;
	htmlUrl: string;
	stats: {
		additions: number;
		deletions: number;
		total: number;
	};
	files: Array<{
		filename: string;
		status: string;
		additions: number;
		deletions: number;
		patch?: string;
	}>;
	diff: string;
}

export interface PullRequestInfo {
	number: number;
	title: string;
	state: string;
	body: string | null;
	user: IssueUser;
	labels: IssueLabel[];
	assignees: IssueUser[];
	milestone: { title: string; state: string } | null;
	createdAt: string;
	updatedAt: string;
	closedAt: string | null;
	mergedAt: string | null;
	htmlUrl: string;
	head: { ref: string; sha: string };
	base: { ref: string; sha: string };
	draft: boolean;
	mergeable: boolean | null;
	additions: number;
	deletions: number;
	changedFiles: number;
	commentsCount: number;
	reviewCommentsCount: number;
	commitsCount: number;
	diff: string;
	reviews: PullRequestReview[];
	timeline: IssueTimelineEvent[];
}

export function parseRepository(repository: string): {
	owner: string;
	repo: string;
} {
	const parts = repository.split("/");
	if (parts.length === 2) {
		return { owner: parts[0], repo: parts[1] };
	}
	throw new Error(
		`Invalid repository format: "${repository}". Expected "owner/repo" format (e.g., "vercel/ai", "facebook/react").`,
	);
}

export function createGitHubClient(config: GitHubConfig = {}) {
	const octokit = new Octokit({
		auth: config.token || undefined,
	});

	return {
		async searchRepos(query: string): Promise<SearchReposResult> {
			const response = await octokit.search.repos({
				q: query,
				per_page: 10,
				sort: "stars",
				order: "desc",
			});

			return {
				totalCount: response.data.total_count,
				items: response.data.items.map((item) => ({
					id: item.id,
					fullName: item.full_name,
					description: item.description,
					htmlUrl: item.html_url,
					language: item.language,
					stargazersCount: item.stargazers_count,
					forksCount: item.forks_count,
					topics: item.topics ?? [],
				})),
			};
		},

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
				content: atob(data.content),
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

		async getIssue(
			owner: string,
			repo: string,
			issueNumber: number,
		): Promise<IssueInfo> {
			const [issueResponse, timelineResponse] = await Promise.all([
				octokit.issues.get({
					owner,
					repo,
					issue_number: issueNumber,
				}),
				octokit.issues.listEventsForTimeline({
					owner,
					repo,
					issue_number: issueNumber,
					per_page: 100,
				}),
			]);

			const issue = issueResponse.data;
			const timeline = parseTimelineEvents(timelineResponse.data);

			return {
				number: issue.number,
				title: issue.title,
				state: issue.state,
				body: issue.body ?? null,
				user: parseUser(issue.user),
				labels: parseLabels(issue.labels),
				assignees: (issue.assignees ?? []).map(parseUser),
				milestone: issue.milestone
					? { title: issue.milestone.title, state: issue.milestone.state }
					: null,
				createdAt: issue.created_at,
				updatedAt: issue.updated_at,
				closedAt: issue.closed_at,
				htmlUrl: issue.html_url,
				commentsCount: issue.comments,
				timeline,
			};
		},

		async getPullRequest(
			owner: string,
			repo: string,
			pullNumber: number,
		): Promise<PullRequestInfo> {
			const [prResponse, diffResponse, reviewsResponse, timelineResponse] =
				await Promise.all([
					octokit.pulls.get({
						owner,
						repo,
						pull_number: pullNumber,
					}),
					octokit.pulls.get({
						owner,
						repo,
						pull_number: pullNumber,
						mediaType: { format: "diff" },
					}),
					octokit.pulls.listReviews({
						owner,
						repo,
						pull_number: pullNumber,
						per_page: 100,
					}),
					octokit.issues.listEventsForTimeline({
						owner,
						repo,
						issue_number: pullNumber,
						per_page: 100,
					}),
				]);

			const pr = prResponse.data;
			const diff = diffResponse.data as unknown as string;
			const timeline = parseTimelineEvents(timelineResponse.data);

			const reviews: PullRequestReview[] = await Promise.all(
				reviewsResponse.data.map(async (review) => {
					const commentsResponse = await octokit.pulls.listCommentsForReview({
						owner,
						repo,
						pull_number: pullNumber,
						review_id: review.id,
						per_page: 100,
					});

					return {
						id: review.id,
						user: parseUser(review.user),
						body: review.body,
						state: review.state,
						submittedAt: review.submitted_at ?? null,
						comments: commentsResponse.data.map((comment) => ({
							id: comment.id,
							path: comment.path,
							line: comment.line ?? null,
							body: comment.body,
							user: parseUser(comment.user),
							createdAt: comment.created_at,
							diffHunk: comment.diff_hunk,
						})),
					};
				}),
			);

			return {
				number: pr.number,
				title: pr.title,
				state: pr.state,
				body: pr.body,
				user: parseUser(pr.user),
				labels: parseLabels(pr.labels),
				assignees: (pr.assignees ?? []).map(parseUser),
				milestone: pr.milestone
					? { title: pr.milestone.title, state: pr.milestone.state }
					: null,
				createdAt: pr.created_at,
				updatedAt: pr.updated_at,
				closedAt: pr.closed_at,
				mergedAt: pr.merged_at,
				htmlUrl: pr.html_url,
				head: { ref: pr.head.ref, sha: pr.head.sha },
				base: { ref: pr.base.ref, sha: pr.base.sha },
				draft: pr.draft ?? false,
				mergeable: pr.mergeable,
				additions: pr.additions,
				deletions: pr.deletions,
				changedFiles: pr.changed_files,
				commentsCount: pr.comments,
				reviewCommentsCount: pr.review_comments,
				commitsCount: pr.commits,
				diff,
				reviews,
				timeline,
			};
		},

		async getCommit(owner: string, repo: string, sha: string): Promise<CommitInfo> {
			const [commitResponse, diffResponse] = await Promise.all([
				octokit.repos.getCommit({
					owner,
					repo,
					ref: sha,
				}),
				octokit.repos.getCommit({
					owner,
					repo,
					ref: sha,
					mediaType: { format: "diff" },
				}),
			]);

			const commit = commitResponse.data;
			const diff = diffResponse.data as unknown as string;

			return {
				sha: commit.sha,
				message: commit.commit.message,
				author: commit.commit.author
					? {
							name: commit.commit.author.name ?? "",
							email: commit.commit.author.email ?? "",
							date: commit.commit.author.date ?? "",
						}
					: null,
				committer: commit.commit.committer
					? {
							name: commit.commit.committer.name ?? "",
							email: commit.commit.committer.email ?? "",
							date: commit.commit.committer.date ?? "",
						}
					: null,
				user: commit.author
					? { login: commit.author.login, htmlUrl: commit.author.html_url }
					: null,
				htmlUrl: commit.html_url,
				stats: {
					additions: commit.stats?.additions ?? 0,
					deletions: commit.stats?.deletions ?? 0,
					total: commit.stats?.total ?? 0,
				},
				files: (commit.files ?? []).map((file) => ({
					filename: file.filename,
					status: file.status,
					additions: file.additions,
					deletions: file.deletions,
					patch: file.patch,
				})),
				diff,
			};
		},
	};
}

export type GitHubClient = ReturnType<typeof createGitHubClient>;
