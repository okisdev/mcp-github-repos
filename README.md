# mcp-github-repos

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server built with [Hono](https://hono.dev) for searching and exploring GitHub repositories.

## Features

- 🔍 **Find Repository** - Search for repositories by name or keywords
- 🔎 **Search Code** - Search code within any GitHub repository
- 📄 **Get File Content** - Retrieve file contents with syntax highlighting
- 📁 **List Files** - Browse directory structures
- ℹ️ **Repository Info** - Get repository metadata (stars, forks, description, etc.)

## Installation

```bash
pnpm install
```

## Usage

### Development

```bash
pnpm dev
```

### Production

```bash
pnpm build
pnpm start
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | POST | Streamable HTTP transport (recommended) |
| `/sse` | GET | SSE transport (legacy, for backwards compatibility) |
| `/messages` | POST | SSE messages endpoint |
| `/` | GET | Health check |

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

For higher rate limits, provide a GitHub token via:

**Environment variable:**

```bash
GITHUB_TOKEN=ghp_xxx pnpm dev
```

**Request header:**

```
X-GitHub-Token: ghp_xxx
```

## Example Requests

```bash
# List tools
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Find repository
curl -X POST http://localhost:3000/mcp \
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

# Search code
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"search_code",
      "arguments":{"repository":"vercel/ai","query":"useChat"}
    },
    "id":3
  }'
```

## License

MIT
