# mcp-github-repos

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server built with [Hono](https://hono.dev) and [@hono/mcp](https://honohub.dev/docs/hono-mcp) for [Cloudflare Workers](https://workers.cloudflare.com), enabling AI to search and explore GitHub repositories.

## Features

- 🔍 **Find Repository** - Search for repositories by name or keywords
- 🔎 **Search Code** - Search code within any GitHub repository
- 📄 **Get File Content** - Retrieve file contents with syntax highlighting
- 📁 **List Files** - Browse directory structures
- ℹ️ **Repository Info** - Get repository metadata (stars, forks, description, etc.)

## Use with Cursor

Add this MCP server to Cursor by editing your `mcp.json` configuration file.

> See [Cursor MCP Documentation](https://cursor.com/docs/context/mcp) for more details.

### Remote Server (Deployed)

```json
{
  "mcpServers": {
    "github-repos": {
      "url": "https://your-worker.your-subdomain.workers.dev/mcp",
      "headers": {
        "X-GitHub-Token": "ghp_xxx"
      }
    }
  }
}
```

### Local Development

```json
{
  "mcpServers": {
    "github-repos": {
      "url": "http://localhost:8787/mcp"
    }
  }
}
```

## Self-Hosting

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

Server runs at `http://localhost:8787`

### Deploy to Cloudflare Workers

```bash
pnpm deploy
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `find_repo` | Search for repositories by name or keywords |
| `search_code` | Search code in a repository (owner/repo format) |
| `get_file_content` | Get file content with syntax highlighting |
| `list_files` | List files in a directory |
| `get_repo_info` | Get repository information |

### `find_repo`

Search for GitHub repositories by name, description, or keywords. **Use this first if you don't know the exact repository name.**

```json
{
  "query": "ai-sdk"
}
```

Example: Searching "ai-sdk" will return `vercel/ai` as a top result.

### `search_code`

Search code in a GitHub repository. Uses `owner/repo` format.

```json
{
  "repository": "vercel/ai",
  "query": "useChat"
}
```

### `get_file_content`

Get the full content of a specific file with syntax highlighting.

```json
{
  "repository": "vercel/ai",
  "path": "packages/react/src/use-chat.ts"
}
```

### `list_files`

List files and directories in a repository path.

```json
{
  "repository": "vercel/ai",
  "path": "packages/react/src"
}
```

### `get_repo_info`

Get repository information including description, stars, forks, etc.

```json
{
  "repository": "vercel/ai"
}
```

## Workflow Example

When asked "search ai-sdk repo for useChat", the AI will:

1. **`find_repo`** - Search for "ai-sdk" → finds `vercel/ai`
2. **`search_code`** - Search "useChat" in `vercel/ai` → finds relevant files
3. **`get_file_content`** - Read full source code if needed
4. Generate explanation based on the code

## GitHub Token (Optional)

For higher rate limits, provide a GitHub token:

### Via Cloudflare Secret (Recommended for production)

```bash
wrangler secret put GITHUB_TOKEN
```

### Via Request Header

```json
{
  "mcpServers": {
    "github-repos": {
      "url": "https://your-worker.workers.dev/mcp",
      "headers": {
        "X-GitHub-Token": "ghp_xxx"
      }
    }
  }
}
```

### Via wrangler.toml (Development only)

```toml
[vars]
GITHUB_TOKEN = "ghp_xxx"
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | ALL | MCP Streamable HTTP endpoint |
| `/` | GET | Health check |

## License

MIT
