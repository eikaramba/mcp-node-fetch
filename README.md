# MCP Node Fetch

An MCP server that enables fetching web content using the Node.js [undici](https://github.com/nodejs/undici) library.

## Features

- Fetch content from any URL using various HTTP methods
- Support for headers and request body
- Return content in various formats (text, JSON, binary, HTML fragments)
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
- `responseType` (string, optional): How to parse the response ("text", "json", "binary", "html-fragment")
- `fragmentSelector` (string, optional): CSS selector to extract specific HTML fragments (when responseType is "html-fragment")
- `followRedirects` (boolean, optional): Whether to follow redirects (default: true)

### `extract-html-fragment`

Extracts specific HTML content from a webpage using CSS selectors and optionally navigates to anchor points.

Parameters:
- `url` (string, required): The URL to fetch
- `selector` (string, required): CSS selector for the HTML fragment to extract
- `anchorId` (string, optional): Optional anchor ID to locate a specific fragment
- `method` (string, optional): HTTP method (default: "GET")
- `headers` (object, optional): HTTP headers to include
- `body` (string, optional): Request body for POST requests
- `timeout` (number, optional): Request timeout in milliseconds
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
      "command": "node",
      "args": ["dist/index.js"]
    }
  }
}
```

## License

MIT
