# mcp-github-repos

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server built with [Hono](https://hono.dev) for searching and exploring GitHub repositories.

## Features

- 🔍 **Find Repository** - Search for repositories by name or keywords
- 🔎 **Search Code** - Search code within any GitHub repository
- 📄 **Get File Content** - Retrieve file contents with syntax highlighting
- 📁 **List Files** - Browse directory structures
- ℹ️ **Repository Info** - Get repository metadata (stars, forks, description, etc.)

## Install in Cursor

### One-Click Install

[Add to Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=GitHub%20Repos&config=eyJ1cmwiOiJodHRwczovL21jcC1naXRodWItcmVwb3MudmVyY2VsLmFwcC9tY3AifQ%3D%3D)

### Manual Configuration

Add to your MCP configuration file:

**Remote Server (Recommended)**

```json
{
  "mcpServers": {
    "github-repos": {
      "url": "https://mcp-github-repos.vercel.app/mcp"
    }
  }
}
```

**With GitHub Token (Higher Rate Limits)**

```json
{
  "mcpServers": {
    "github-repos": {
      "url": "https://mcp-github-repos.vercel.app/mcp",
      "headers": {
        "X-GitHub-Token": "${env:GITHUB_TOKEN}"
      }
    }
  }
}
```

### Configuration File Locations

| Location | Path | Scope |
|----------|------|-------|
| **Project** | `.cursor/mcp.json` | Current project only |
| **Global** | `~/.cursor/mcp.json` | All projects |

## Self-Hosting

### Development

```bash
pnpm install
pnpm dev
```

### Production

```bash
pnpm build
pnpm start
```

### Deploy to Vercel

```bash
vercel deploy
```

Then update your MCP config to use your deployment URL.

## MCP Tools

### `find_repo`

Search for GitHub repositories by name, description, or keywords. **Use this first if you don't know the exact repository name.**

```json
{
  "query": "ai-sdk"
}
```

Example: Searching "ai-sdk" will return `vercel/ai` as the top result.

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

For higher rate limits (anonymous: 10 req/min, authenticated: 30 req/min), provide a GitHub token:

**Via Environment Variable:**

```bash
GITHUB_TOKEN=ghp_xxx pnpm dev
```

**Via Request Header:**

```
X-GitHub-Token: ghp_xxx
```

**Via MCP Config:**

```json
{
  "mcpServers": {
    "github-repos": {
      "url": "https://mcp-github-repos.vercel.app/mcp",
      "headers": {
        "X-GitHub-Token": "${env:GITHUB_TOKEN}"
      }
    }
  }
}
```

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | POST | MCP endpoint (Streamable HTTP) |
| `/mcp` | DELETE | Session cleanup (stateless, no-op) |
| `/` | GET | Health check |

> **Note**: This server uses **Streamable HTTP** transport (stateless), compatible with serverless environments like Vercel.

## Example Requests

```bash
# Health check
curl https://mcp-github-repos.vercel.app

# List tools
curl -X POST https://mcp-github-repos.vercel.app/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Find repository
curl -X POST https://mcp-github-repos.vercel.app/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"find_repo",
      "arguments":{"query":"ai-sdk"}
    },
    "id":2
  }'
```

## License

MIT
