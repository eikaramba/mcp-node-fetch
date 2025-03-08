import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  // Create a client
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

  // Connect to our server
  const transport = new StdioClientTransport({
    command: "node",
    args: ["/Users/matteo/repos/mcp-node-fetch/dist/index.js"]
  });

  try {
    await client.connect(transport);
    console.log("Connected to server");

    // List tools
    const tools = await client.listTools();
    console.log("Available tools:");
    for (const tool of tools.tools) {
      console.log(`- ${tool.name}: ${tool.description}`);
    }

    // Test fetch-url tool
    console.log("\nTesting fetch-url tool...");
    const fetchResult = await client.callTool({
      name: "fetch-url",
      arguments: {
        url: "https://jsonplaceholder.typicode.com/posts/1",
        responseType: "json"
      }
    });
    console.log("Fetch result:", fetchResult);

    // Test check-status tool
    console.log("\nTesting check-status tool...");
    const statusResult = await client.callTool({
      name: "check-status",
      arguments: {
        url: "https://example.com"
      }
    });
    console.log("Status result:", statusResult);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.close();
  }
}

main();
