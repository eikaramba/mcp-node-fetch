import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema, 
  CallToolResult,
  Tool
} from "@modelcontextprotocol/sdk/types.js";
import { fetch } from "undici";
import { z } from "zod";

// Define the arguments schemas for our tools
const FetchUrlArgsSchema = z.object({
  url: z.string().url().describe("URL to fetch"),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "PATCH"]).default("GET").describe("HTTP method"),
  headers: z.record(z.string()).optional().describe("HTTP headers"),
  body: z.string().optional().describe("Request body for POST/PUT/PATCH requests"),
  timeout: z.number().positive().optional().describe("Request timeout in milliseconds"),
  responseType: z.enum(["text", "json", "binary"]).default("text").describe("How to parse the response"),
  followRedirects: z.boolean().default(true).describe("Whether to follow redirects")
});

const CheckStatusArgsSchema = z.object({
  url: z.string().url().describe("URL to check"),
  timeout: z.number().positive().optional().describe("Request timeout in milliseconds")
});

// Define type interfaces
type FetchUrlArgs = z.infer<typeof FetchUrlArgsSchema>;
type CheckStatusArgs = z.infer<typeof CheckStatusArgsSchema>;

// Available tools
const TOOLS: Tool[] = [
  {
    name: "fetch-url",
    description: "Fetch content from a URL",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to fetch" },
        method: { 
          type: "string", 
          enum: ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "PATCH"], 
          default: "GET", 
          description: "HTTP method" 
        },
        headers: { 
          type: "object", 
          additionalProperties: { type: "string" }, 
          description: "HTTP headers" 
        },
        body: { type: "string", description: "Request body for POST/PUT/PATCH requests" },
        timeout: { type: "number", description: "Request timeout in milliseconds" },
        responseType: { 
          type: "string", 
          enum: ["text", "json", "binary"], 
          default: "text", 
          description: "How to parse the response" 
        },
        followRedirects: { 
          type: "boolean", 
          default: true, 
          description: "Whether to follow redirects" 
        }
      },
      required: ["url"]
    }
  },
  {
    name: "check-status",
    description: "Check if a URL is accessible (HEAD request)",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to check" },
        timeout: { type: "number", description: "Request timeout in milliseconds" }
      },
      required: ["url"]
    }
  }
];

// Initialize server
const server = new Server(
  {
    name: "node-fetch",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Register the tools/list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS
  };
});

// Register tools/call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "fetch-url":
      return handleFetchUrl(FetchUrlArgsSchema.parse(args));
    case "check-status":
      return handleCheckStatus(CheckStatusArgsSchema.parse(args));
    default:
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Unknown tool: ${name}`
          }
        ]
      };
  }
});

// Handler for fetch-url tool
async function handleFetchUrl(args: FetchUrlArgs): Promise<CallToolResult> {
  try {
    const { url, method, headers, body, timeout, responseType, followRedirects } = args;
    
    // Log the fetch request
    console.error(`Fetching ${url} with method ${method}`);
    
    // Create request options
    const options: any = {
      method,
      headers: headers || {},
      body: body || undefined,
      redirect: followRedirects ? "follow" : "manual",
    };
    
    if (timeout) {
      // @ts-ignore - undici specific options
      options.bodyTimeout = timeout;
      // @ts-ignore - undici specific options
      options.headersTimeout = timeout;
    }
    
    // Perform the request
    const response = await fetch(url, options);
    
    // Create a result object with metadata
    const result: Record<string, any> = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      url: response.url,
    };
    
    // Process the response based on the requested type
    switch (responseType) {
      case "json":
        try {
          const jsonContent = await response.json();
          result.content = JSON.stringify(jsonContent, null, 2);
        } catch (e) {
          throw new Error(`Failed to parse response as JSON: ${(e as Error).message}`);
        }
        break;
      
      case "binary":
        const buffer = await response.arrayBuffer();
        result.content = Buffer.from(buffer).toString("base64");
        result.encoding = "base64";
        break;
      
      case "text":
      default:
        result.content = await response.text();
        break;
    }
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    console.error(`Error fetching URL:`, error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error fetching URL: ${(error as Error).message}`
        }
      ]
    };
  }
}

// Handler for check-status tool
async function handleCheckStatus(args: CheckStatusArgs): Promise<CallToolResult> {
  try {
    const { url, timeout } = args;
    
    console.error(`Checking status of ${url}`);
    
    // Create request options
    const options: any = {
      method: "HEAD",
    };
    
    if (timeout) {
      // @ts-ignore - undici specific options
      options.headersTimeout = timeout;
    }
    
    // Perform the request
    const response = await fetch(url, options);
    
    // Create a result object
    const result = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      url: response.url,
      isAvailable: response.ok,
    };
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    console.error(`Error checking URL status:`, error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error checking URL status: ${(error as Error).message}`
        }
      ]
    };
  }
}

// Start the server using stdio transport
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP Node Fetch server started");
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

main();
