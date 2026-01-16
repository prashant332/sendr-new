#!/usr/bin/env node

import { spawn } from "child_process";
import { join } from "path";
import { existsSync } from "fs";

// Parse command line arguments
const args = process.argv.slice(2);

// Handle help flag
if (args.includes("--help") || args.includes("-h")) {
  console.log(`
  Sendr - Browser-based API Testing Tool

  Usage: sendr [options]

  Options:
    -p, --port <port>   Port to run the server on (default: 3000)
    -h, --help          Show this help message
    -v, --version       Show version number

  Examples:
    sendr                    Start on default port 3000
    sendr --port 8080        Start on port 8080
    sendr -p 4000            Start on port 4000

  Documentation: https://github.com/prashant/sendr
  `);
  process.exit(0);
}

// Handle version flag
if (args.includes("--version") || args.includes("-v")) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const packageJson = require("../package.json");
  console.log(`sendr v${packageJson.version}`);
  process.exit(0);
}

// Parse port from arguments
let port = process.env.PORT || 3000;
const portFlagIndex = args.findIndex((a) => a === "--port" || a === "-p");
if (portFlagIndex !== -1 && args[portFlagIndex + 1]) {
  port = args[portFlagIndex + 1];
}
const portArgMatch = args.find((a) => a.startsWith("--port="));
if (portArgMatch) {
  port = portArgMatch.split("=")[1];
}

// Validate port
const portNum = parseInt(port, 10);
if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
  console.error(`Error: Invalid port number "${port}". Must be between 1 and 65535.`);
  process.exit(1);
}

// Display banner
console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   ███████╗███████╗███╗   ██╗██████╗ ██████╗              ║
  ║   ██╔════╝██╔════╝████╗  ██║██╔══██╗██╔══██╗             ║
  ║   ███████╗█████╗  ██╔██╗ ██║██║  ██║██████╔╝             ║
  ║   ╚════██║██╔══╝  ██║╚██╗██║██║  ██║██╔══██╗             ║
  ║   ███████║███████╗██║ ╚████║██████╔╝██║  ██║             ║
  ║   ╚══════╝╚══════╝╚═╝  ╚═══╝╚═════╝ ╚═╝  ╚═╝             ║
  ║                                                           ║
  ║   Browser-based API Testing Tool                          ║
  ╚═══════════════════════════════════════════════════════════╝
`);

// Find the server file
const possiblePaths = [
  join(__dirname, "..", ".next", "standalone", "server.js"),
  join(__dirname, "..", "server.js"),
];

let serverPath = null;
for (const p of possiblePaths) {
  if (existsSync(p)) {
    serverPath = p;
    break;
  }
}

if (!serverPath) {
  console.error("Error: Server files not found.");
  console.error("If you installed via npm, the package may need to be rebuilt.");
  console.error("Try: npm rebuild sendr");
  process.exit(1);
}

console.log(`  Starting server on http://localhost:${portNum}`);
console.log(`  Press Ctrl+C to stop\n`);

// Set environment variables
const env = {
  ...process.env,
  PORT: portNum.toString(),
  HOSTNAME: "0.0.0.0",
};

// Start the server
const server = spawn("node", [serverPath], {
  stdio: "inherit",
  env,
});

server.on("error", (err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});

server.on("close", (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Server exited with code ${code}`);
  }
  process.exit(code || 0);
});

// Handle shutdown signals
const shutdown = () => {
  console.log("\n  Shutting down Sendr...");
  server.kill("SIGTERM");
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
