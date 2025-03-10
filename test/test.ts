/**
 * Tests for the Model Context Protocol (MCP) Node Fetch tools
 * 
 * This test suite validates the functionality of the MCP Node Fetch server
 * which provides web-related tools (fetch-url, check-status, extract-html-fragment)
 * to MCP clients.
 * 
 * The tests use a local HTTP server to avoid external dependencies,
 * making the tests more reliable and self-contained.
 * 
 * Each test creates a fresh client connected to a new server instance,
 * performs operations, and validates the results.
 */

import { test, describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { TestServer } from "./helpers/test-server.ts";

/**
 * Test suite for MCP Node Fetch tools.
 * Runs tests against all available tools to ensure proper functionality.
 */

// Types for the tools
type FetchUrlArgs = {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "HEAD" | "OPTIONS" | "PATCH";
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  responseType?: "text" | "json" | "binary" | "html-fragment";
  followRedirects?: boolean;
  fragmentSelector?: string;
};

type ExtractHtmlFragmentArgs = {
  url: string;
  selector: string;
  anchorId?: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  followRedirects?: boolean;
};

type CheckStatusArgs = {
  url: string;
  timeout?: number;
};

/**
 * Utility function to create a connected client for testing
 * @returns Promise<Client> - Connected MCP client
 */
async function createConnectedClient(): Promise<Client> {
  const client = new Client(
    {
      name: "test-client",
      version: "1.0.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  const transport = new StdioClientTransport({
    command: "node",
    args: ["--no-warnings", "--experimental-strip-types", "/Users/matteo/repos/mcp-node-fetch/src/index.ts"]
  });

  await client.connect(transport);
  return client;
}

describe('Model Context Protocol Node Fetch Tests', () => {
  let client: Client;
  let testServer: TestServer;
  let baseUrl: string;

  beforeEach(async () => {
    // Set up test server
    testServer = new TestServer();
    testServer.addCommonRoutes();
    await testServer.start();
    baseUrl = testServer.getBaseUrl();
    
    // Create client
    client = await createConnectedClient();
  });

  afterEach(async () => {
    if (client) {
      await client.close();
    }
    if (testServer) {
      await testServer.stop();
    }
  });

  /**
   * Test basic connection to the server
   */
  it('should connect to the server successfully', () => {
    assert.ok(client, 'Client should be connected');
  });

  /**
   * Test listing available tools from the server
   */
  it('should list available tools', async () => {
    const tools = await client.listTools();
    
    assert.ok(tools.tools, 'Tools list should be available');
    assert.ok(Array.isArray(tools.tools), 'Tools should be in an array');
    assert.ok(tools.tools.length > 0, 'At least one tool should be available');
    
    // Check for expected tools
    const toolNames = tools.tools.map(tool => tool.name);
    assert.ok(toolNames.includes('fetch-url'), 'fetch-url tool should be available');
    assert.ok(toolNames.includes('check-status'), 'check-status tool should be available');
    assert.ok(toolNames.includes('extract-html-fragment'), 'extract-html-fragment tool should be available');
  });

  /**
   * Test fetching JSON data from a URL
   * Verifies that the fetch-url tool correctly retrieves and parses JSON data
   */
  it('should fetch JSON data from a URL', async () => {
    const args: FetchUrlArgs = {
      url: `${baseUrl}/json`,
      responseType: "json"
    };

    const result = await client.callTool({
      name: "fetch-url",
      arguments: args
    });

    assert.ok(result, 'Result should be returned');
    assert.ok(!result.isError, 'Result should not be an error');
    
    // Parse the result content
    const resultContent = JSON.parse(result.content[0].text);
    assert.equal(resultContent.status, 200, 'HTTP status should be 200');
    
    // Check if the content was properly parsed as JSON
    const content = JSON.parse(resultContent.content);
    assert.equal(content.id, 1, 'Response should contain post with ID 1');
    assert.equal(content.title, 'Test Post', 'Response should include the expected title');
  });

  it('should check if a URL is accessible', async () => {
    const args: CheckStatusArgs = {
      url: `${baseUrl}/status`
    };

    const result = await client.callTool({
      name: "check-status",
      arguments: args
    });

    assert.ok(result, 'Result should be returned');
    assert.ok(!result.isError, 'Result should not be an error');
    
    // Parse the result content
    const resultContent = JSON.parse(result.content[0].text);
    assert.equal(resultContent.status, 200, 'HTTP status should be 200');
    assert.ok(resultContent.isAvailable, 'URL should be available');
  });

  it('should extract HTML fragment from a website', async () => {
    const args: ExtractHtmlFragmentArgs = {
      url: `${baseUrl}/`,
      selector: "h1"
    };

    const result = await client.callTool({
      name: "extract-html-fragment",
      arguments: args
    });

    assert.ok(result, 'Result should be returned');
    assert.ok(!result.isError, 'Result should not be an error');
    
    // Parse the result content
    const resultContent = JSON.parse(result.content[0].text);
    assert.equal(resultContent.status, 200, 'HTTP status should be 200');
    assert.equal(resultContent.matchCount, 1, 'Should find exactly one h1 element');
    assert.ok(resultContent.html.includes('<h1>Test Heading</h1>'), 'Should contain the expected h1 content');
  });

  it('should handle errors for non-existent URLs', async () => {
    const args: FetchUrlArgs = {
      url: `${baseUrl}/error`,
      responseType: "text"
    };

    const result = await client.callTool({
      name: "fetch-url",
      arguments: args
    });

    assert.ok(result, 'Result should be returned');
    assert.ok(result.isError, 'Result should be an error');
    assert.ok(result.content[0].text.includes('Error fetching URL'), 'Error message should be descriptive');
  });

  it('should handle invalid selectors when extracting HTML', async () => {
    const args: ExtractHtmlFragmentArgs = {
      url: `${baseUrl}/`,
      selector: "nonexistent-element"
    };

    const result = await client.callTool({
      name: "extract-html-fragment",
      arguments: args
    });

    assert.ok(result, 'Result should be returned');
    assert.ok(result.isError, 'Result should be an error');
    assert.ok(result.content[0].text.includes('No elements found matching selector'), 'Error message should be descriptive');
  });

  it('should follow redirects by default', async () => {
    const args: FetchUrlArgs = {
      url: `${baseUrl}/redirect`,
      responseType: "text",
      method: "HEAD"
    };

    const result = await client.callTool({
      name: "fetch-url",
      arguments: args
    });

    assert.ok(result, 'Result should be returned');
    assert.ok(!result.isError, 'Result should not be an error');
    
    // Parse the result content
    const resultContent = JSON.parse(result.content[0].text);
    assert.equal(resultContent.status, 200, 'HTTP status should be 200');
    // Check that we were redirected
    assert.ok(resultContent.url !== `${baseUrl}/redirect`, 'URL should be redirected');
  });

  it('should parse HTML fragments when requested', async () => {
    const args: FetchUrlArgs = {
      url: `${baseUrl}/`,
      responseType: "html-fragment",
      fragmentSelector: "div"
    };

    const result = await client.callTool({
      name: "fetch-url",
      arguments: args
    });

    assert.ok(result, 'Result should be returned');
    assert.ok(!result.isError, 'Result should not be an error');
    
    // Parse the result content
    const resultContent = JSON.parse(result.content[0].text);
    assert.equal(resultContent.status, 200, 'HTTP status should be 200');
    assert.ok(resultContent.matchCount > 0, 'Should find at least one div element');
    assert.ok(resultContent.content.includes('<div class="content">'), 'Should contain the expected div element');
  });
});
