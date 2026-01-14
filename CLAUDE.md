# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # Start local dev server at http://localhost:8787
pnpm build      # Build (dry-run deploy to dist/)
pnpm deploy     # Deploy to Cloudflare Workers
pnpm typecheck  # Run TypeScript type checking
```

## Architecture

This is an MCP (Model Context Protocol) server that enables AI to search and explore GitHub repositories. It runs on Cloudflare Workers using Hono.

### Source Structure

- **`src/index.ts`** - Hono app entry point with `/mcp` endpoint (StreamableHTTPTransport) and `/` health check
- **`src/mcp-server.ts`** - MCP server with tool definitions (find_repo, search_code, get_file_content, list_files, get_repo_info, get_issue, get_pull_request, get_commit)
- **`src/github.ts`** - GitHub API client using @octokit/rest, type definitions for all API responses
- **`src/utils.ts`** - Shared utilities: date formatting, MCP response helpers, GitHub API parsers

### Key Patterns

- All MCP tools use `textContent()` and `errorContent()` helpers for consistent responses
- GitHub API parsing uses shared functions: `parseUser()`, `parseLabel()`, `parseLabels()`, `parseTimelineEvents()`
- Repository format is always `owner/repo` (e.g., `vercel/ai`)
- GitHub token can be passed via `X-GitHub-Token` header or `GITHUB_TOKEN` env var
