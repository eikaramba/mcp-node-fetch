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
import { JSDOM } from "jsdom";

// Define the arguments schemas for our tools
const FetchUrlArgsSchema = z.object({
  url: z.string().url().describe("URL to fetch"),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "PATCH"]).default("GET").describe("HTTP method"),
  headers: z.record(z.string()).optional().describe("HTTP headers"),
  body: z.string().optional().describe("Request body for POST/PUT/PATCH requests"),
  timeout: z.number().positive().optional().describe("Request timeout in milliseconds"),
  responseType: z.enum(["text", "json", "binary", "html-fragment"]).default("text").describe("How to parse the response"),
  followRedirects: z.boolean().default(true).describe("Whether to follow redirects"),
  fragmentSelector: z.string().optional().describe("CSS selector for the HTML fragment to extract (when responseType is html-fragment)")
});

const ExtractHtmlFragmentArgsSchema = z.object({
  url: z.string().url().describe("URL to fetch"),
  selector: z.string().describe("CSS selector for the HTML fragment to extract"),
  anchorId: z.string().optional().describe("Optional anchor ID to locate a specific fragment"),
  method: z.enum(["GET", "POST"]).default("GET").describe("HTTP method"),
  headers: z.record(z.string()).optional().describe("HTTP headers"),
  body: z.string().optional().describe("Request body for POST requests"),
  timeout: z.number().positive().optional().describe("Request timeout in milliseconds"),
  followRedirects: z.boolean().default(true).describe("Whether to follow redirects")
});

const CheckStatusArgsSchema = z.object({
  url: z.string().url().describe("URL to check"),
  timeout: z.number().positive().optional().describe("Request timeout in milliseconds")
});

// Define type interfaces
type FetchUrlArgs = z.infer<typeof FetchUrlArgsSchema>;
type ExtractHtmlFragmentArgs = z.infer<typeof ExtractHtmlFragmentArgsSchema>;
type CheckStatusArgs = z.infer<typeof CheckStatusArgsSchema>;

// Available tools
const TOOLS: Tool[] = [
  {
    name: "extract-html-fragment",
    description: "Extract a specific HTML fragment from a webpage using CSS selectors",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to fetch" },
        selector: { type: "string", description: "CSS selector for the HTML fragment to extract" },
        anchorId: { type: "string", description: "Optional anchor ID to locate a specific fragment" },
        method: { 
          type: "string", 
          enum: ["GET", "POST"], 
          default: "GET", 
          description: "HTTP method" 
        },
        headers: { 
          type: "object", 
          additionalProperties: { type: "string" }, 
          description: "HTTP headers" 
        },
        body: { type: "string", description: "Request body for POST requests" },
        timeout: { type: "number", description: "Request timeout in milliseconds" },
        followRedirects: { 
          type: "boolean", 
          default: true, 
          description: "Whether to follow redirects" 
        },
        fragmentSelector: { 
          type: "string", 
          description: "CSS selector for the HTML fragment to extract (when responseType is html-fragment)" 
        }
      },
      required: ["url", "selector"]
    }
  },
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
          enum: ["text", "json", "binary", "html-fragment"], 
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
    case "extract-html-fragment":
      return handleExtractHtmlFragment(ExtractHtmlFragmentArgsSchema.parse(args));
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
      
      case "html-fragment":
        try {
          const htmlContent = await response.text();
          // Use JSDOM to parse the HTML
          const dom = new JSDOM(htmlContent);
          const document = dom.window.document;
          
          // Only look for fragments if a selector is provided
          if (args.fragmentSelector) {
            const elements = document.querySelectorAll(args.fragmentSelector);
            if (elements.length === 0) {
              throw new Error(`No elements found matching selector "${args.fragmentSelector}"`);
            }
            
            // Extract the HTML from the selected element(s)
            if (elements.length === 1) {
              result.content = elements[0].outerHTML;
            } else {
              result.content = Array.from(elements).map(el => el.outerHTML).join('\n');
            }
            result.matchCount = elements.length;
          } else {
            // No selector provided, return the full HTML
            result.content = htmlContent;
          }
          result.contentType = 'text/html';
        } catch (e) {
          throw new Error(`Failed to parse or extract HTML fragment: ${(e as Error).message}`);
        }
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

// Handler for extract-html-fragment tool
async function handleExtractHtmlFragment(args: ExtractHtmlFragmentArgs): Promise<CallToolResult> {
  try {
    const { url, selector, anchorId, method, headers, body, timeout, followRedirects } = args;
    
    console.error(`Extracting HTML fragment from ${url} using selector "${selector}"`); 
    
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
    
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: HTTP ${response.status} ${response.statusText}`);
    }
    
    // Get the HTML content
    const html = await response.text();
    
    // Parse the HTML using JSDOM
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Handle anchor if provided
    if (anchorId) {
      // Scroll to the anchor element
      const anchorElement = document.getElementById(anchorId);
      if (!anchorElement) {
        throw new Error(`Anchor element with ID "${anchorId}" not found`);
      }
    }
    
    // Find the element(s) matching the selector
    const elements = document.querySelectorAll(selector);
    
    if (elements.length === 0) {
      throw new Error(`No elements found matching selector "${selector}"`);
    }
    
    // Create a result object
    const result: Record<string, any> = {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      selector: selector,
      matchCount: elements.length,
    };
    
    // Get the HTML content of the selected elements
    if (elements.length === 1) {
      // If only one element found, return its outer HTML
      result.html = elements[0].outerHTML;
    } else {
      // If multiple elements found, return an array of their outer HTML
      result.html = Array.from(elements).map(el => el.outerHTML);
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
    console.error(`Error extracting HTML fragment:`, error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error extracting HTML fragment: ${(error as Error).message}`
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
