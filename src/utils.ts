import type { IssueLabel, IssueTimelineEvent, IssueUser } from "./github";

export function formatDate(date: string): string {
	return new Date(date).toLocaleString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function textContent(text: string): { content: Array<{ type: "text"; text: string }> } {
	return { content: [{ type: "text", text }] };
}

export function errorContent(message: string): { content: Array<{ type: "text"; text: string }>; isError: true } {
	return { content: [{ type: "text", text: message }], isError: true };
}

export function getPrStateIcon(state: string, draft: boolean, mergedAt: string | null): string {
	if (state === "open") {
		return draft ? "📝 Draft" : "🟢 Open";
	}
	return mergedAt ? "🟣 Merged" : "🔴 Closed";
}

export function getReviewStateEmoji(state: string): string {
	const emojiMap: Record<string, string> = {
		APPROVED: "✅",
		CHANGES_REQUESTED: "❌",
		COMMENTED: "💬",
		DISMISSED: "🚫",
		PENDING: "⏳",
	};
	return emojiMap[state] || "📋";
}

export function getFileStatusIcon(status: string): string {
	if (status === "added") return "➕";
	if (status === "removed") return "➖";
	return "📝";
}

export function getCommitAuthorInfo(commit: {
	author: { name: string; email: string; date: string } | null;
	user: { login: string } | null;
}): string {
	if (commit.author) {
		const dateStr = commit.author.date ? ` on ${formatDate(commit.author.date)}` : "";
		return `**Author:** ${commit.author.name} <${commit.author.email}>${dateStr}`;
	}
	if (commit.user) {
		return `**Author:** @${commit.user.login}`;
	}
	return "**Author:** Unknown";
}

export function parseUser(user: { login: string; html_url: string } | null): IssueUser {
	return {
		login: user?.login ?? "unknown",
		htmlUrl: user?.html_url ?? "",
	};
}

export function parseLabel(label: {
	name?: string;
	color?: string | null;
	description?: string | null;
}): IssueLabel {
	return {
		name: label.name ?? "",
		color: label.color ?? "",
		description: label.description ?? null,
	};
}

export function parseLabels(
	labels: Array<string | { name?: string; color?: string | null; description?: string | null }>,
): IssueLabel[] {
	return labels.map((label) =>
		typeof label === "string" ? { name: label, color: "", description: null } : parseLabel(label),
	);
}

export function parseTimelineEvents(
	events: Array<{ event?: string | null; [key: string]: unknown }>,
): IssueTimelineEvent[] {
	return events.map((event) => {
		const typedEvent = event as {
			event?: string | null;
			created_at?: string;
			actor?: { login: string; html_url: string };
			body?: string;
			label?: { name?: string; color?: string; description?: string | null };
			assignee?: { login: string; html_url: string };
			milestone?: { title: string };
			rename?: { from: string; to: string };
			source?: { issue?: { number: number; title: string } };
			commit_id?: string;
			commit_url?: string;
		};

		const base: IssueTimelineEvent = {
			type: typedEvent.event ?? "unknown",
			createdAt: typedEvent.created_at ?? "",
			actor: typedEvent.actor ? parseUser(typedEvent.actor) : undefined,
		};

		const eventType = typedEvent.event;

		if (eventType === "commented" || eventType === "reviewed") {
			base.body = typedEvent.body ?? "";
		}

		if (eventType === "labeled" || eventType === "unlabeled") {
			if (typedEvent.label) {
				base.label = parseLabel(typedEvent.label);
			}
		}

		if (eventType === "assigned" || eventType === "unassigned") {
			if (typedEvent.assignee) {
				base.assignee = parseUser(typedEvent.assignee);
			}
		}

		if (eventType === "milestoned" || eventType === "demilestoned") {
			if (typedEvent.milestone) {
				base.milestone = { title: typedEvent.milestone.title };
			}
		}

		if (eventType === "renamed" && typedEvent.rename) {
			base.rename = typedEvent.rename;
		}

		if (eventType === "cross-referenced" && typedEvent.source?.issue) {
			base.source = {
				issue: {
					number: typedEvent.source.issue.number,
					title: typedEvent.source.issue.title,
				},
			};
		}

		if (eventType === "referenced" || eventType === "committed") {
			base.commitId = typedEvent.commit_id;
			base.commitUrl = typedEvent.commit_url;
		}

		return base;
	});
}
