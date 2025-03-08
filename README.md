# MCP Node Fetch

An MCP server that enables fetching web content using the Node.js [undici](https://github.com/nodejs/undici) library.

## Features

- Fetch content from any URL using various HTTP methods
- Support for headers and request body
- Return content in various formats (text, JSON, binary)
- Handle errors gracefully
- Configure timeout and redirect behavior

## MCP Tools

This server provides the following MCP tools:

### `fetch-url`

Fetches content from a URL and returns it.

Parameters:
- `url` (string, required): The URL to fetch
- `method` (string, optional): HTTP method (default: "GET")
- `headers` (object, optional): HTTP headers to include
- `body` (string, optional): Request body for POST/PUT requests
- `timeout` (number, optional): Request timeout in milliseconds
- `responseType` (string, optional): How to parse the response ("text", "json", "binary")
- `followRedirects` (boolean, optional): Whether to follow redirects (default: true)

### `check-status`

Checks if a URL is accessible without downloading the full content.

Parameters:
- `url` (string, required): The URL to check
- `timeout` (number, optional): Request timeout in milliseconds


## Claude for Desktop Configuration

To use with Claude for Desktop, add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "node-fetch": {
      "command": "npx",
      "args": ["-y", "mcp-ripgrep@latest"]
    }
  }
}
```

## License

MIT
