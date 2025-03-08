import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetch } from "undici";

// Create schemas for our tools
const FetchUrlSchema = z.object({
  method: "tools/call",
  params: z.object({
    name: z.literal("fetch-url"),
    arguments: z.object({
      url: z.string().url().describe("URL to fetch"),
      method: z.enum(["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "PATCH"]).default("GET").describe("HTTP method"),
      headers: z.record(z.string()).optional().describe("HTTP headers"),
      body: z.string().optional().describe("Request body for POST/PUT/PATCH requests"),
      timeout: z.number().positive().optional().describe("Request timeout in milliseconds"),
      responseType: z.enum(["text", "json", "binary"]).default("text").describe("How to parse the response"),
      followRedirects: z.boolean().default(true).describe("Whether to follow redirects")
    })
  })
});

const CheckStatusSchema = z.object({
  method: "tools/call",
  params: z.object({
    name: z.literal("check-status"),
    arguments: z.object({
      url: z.string().url().describe("URL to check"),
      timeout: z.number().positive().optional().describe("Request timeout in milliseconds")
    })
  })
});

const ListToolsSchema = z.object({
  method: "tools/list"
});

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
server.setRequestHandler(ListToolsSchema, async () => {
  return {
    tools: [
      {
        name: "fetch-url",
        description: "Fetch content from a URL",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to fetch" },
            method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "PATCH"], default: "GET", description: "HTTP method" },
            headers: { type: "object", additionalProperties: { type: "string" }, description: "HTTP headers" },
            body: { type: "string", description: "Request body for POST/PUT/PATCH requests" },
            timeout: { type: "number", description: "Request timeout in milliseconds" },
            responseType: { type: "string", enum: ["text", "json", "binary"], default: "text", description: "How to parse the response" },
            followRedirects: { type: "boolean", default: true, description: "Whether to follow redirects" }
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
    ]
  };
});

// Register fetch-url handler
server.setRequestHandler(FetchUrlSchema, async (request) => {
  try {
    const { url, method, headers, body, timeout, responseType, followRedirects } = request.params.arguments;
    
    // Log the fetch request
    console.error(`Fetching ${url} with method ${method}`);
    
    // Create request options
    const options = {
      method,
      headers: headers || {},
      body: body || undefined,
      redirect: followRedirects ? "follow" : "manual",
    };
    
    if (timeout) {
      options.bodyTimeout = timeout;
      options.headersTimeout = timeout;
    }
    
    // Perform the request
    const response = await fetch(url, options);
    
    // Create a result object with metadata
    const result = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      url: response.url,
    };
    
    // Process the response based on the requested type
    let content;
    switch (responseType) {
      case "json":
        try {
          content = await response.json();
          result.content = JSON.stringify(content, null, 2);
        } catch (e) {
          throw new Error(`Failed to parse response as JSON: ${e.message}`);
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