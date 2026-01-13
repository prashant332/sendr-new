import { ScriptContext, ScriptType } from "./types";

export function buildSystemPrompt(
  scriptType: ScriptType,
  context: ScriptContext
): string {
  const basePrompt = `You are an expert JavaScript developer specializing in API testing scripts.
You generate scripts for Sendr, an API testing tool similar to Postman.

## Available API (pm object)

### Environment Variables
- pm.environment.get(key: string): string | undefined - Get an environment variable
- pm.environment.set(key: string, value: string): void - Set an environment variable

${scriptType === "test" ? getTestScriptAPIs(context.requestDetails.isGrpc) : ""}

## Rules
1. Generate clean, readable JavaScript code
2. Always use const/let, never var
3. Handle edge cases (null checks, empty arrays)
4. Use descriptive variable names
5. Add brief comments for complex logic
${scriptType === "test" ? "6. Use pm.test() to wrap assertions\n7. Store complex objects as JSON strings in environment variables" : "6. Store complex objects as JSON strings in environment variables"}
8. Never use console.log (it won't be visible)
9. Do not use fetch, require, import, eval, or Function constructor
10. Only use the pm object APIs listed above

${context.responseSchema ? `## Response Data Structure\n\`\`\`json\n${JSON.stringify(context.responseSchema, null, 2)}\n\`\`\`\n` : ""}

${context.responseSample ? `## Sample Response Data\n\`\`\`json\n${JSON.stringify(context.responseSample, null, 2)}\n\`\`\`\n` : ""}

${context.environmentVariables.length > 0 ? `## Available Environment Variables\n${context.environmentVariables.map(v => `- ${v}`).join("\n")}\n` : ""}

${context.existingScript ? `## Existing Script (modify or extend this)\n\`\`\`javascript\n${context.existingScript}\n\`\`\`\n` : ""}

## Output Format
Respond with ONLY:
1. A markdown code block containing the JavaScript code
2. A brief explanation (1-2 sentences) after the code block

Do not include any other text, warnings, or suggestions outside this format.`;

  return basePrompt;
}

function getTestScriptAPIs(isGrpc: boolean): string {
  const httpAPIs = `### Response (Test Scripts Only)
- pm.response.json(): any - Parse response body as JSON
- pm.response.text(): string - Get response body as text
- pm.response.status: number - HTTP status code
- pm.response.statusText: string - HTTP status text
- pm.response.headers: Record<string, string> - Response headers
- pm.response.time: number - Response time in milliseconds`;

  const grpcAPIs = `### Response (Test Scripts Only - gRPC)
- pm.response.json(): any - Parse response message as JSON
- pm.response.metadata(key?: string): Record<string, string> | string - Response metadata
- pm.response.trailers(key?: string): Record<string, string> | string - Response trailers
- pm.response.status.code: number - gRPC status code (0-16)
- pm.response.status.details: string - Status message`;

  const testingAPIs = `

### Testing
- pm.test(name: string, fn: () => void): void - Define a test assertion
- pm.expect(value: any): ChaiAssertion - Create an assertion

### Common pm.expect assertions
- pm.expect(value).to.equal(expected) - Strict equality
- pm.expect(value).to.eql(expected) - Deep equality
- pm.expect(value).to.be.true / .to.be.false
- pm.expect(value).to.be.null / .to.be.undefined
- pm.expect(value).to.be.above(n) / .to.be.below(n)
- pm.expect(value).to.be.an("array") / .to.be.an("object")
- pm.expect(array).to.have.lengthOf(n)
- pm.expect(array).to.include(item)
- pm.expect(object).to.have.property("key")
- pm.expect(string).to.match(/regex/)`;

  return (isGrpc ? grpcAPIs : httpAPIs) + testingAPIs;
}

export function buildUserPrompt(prompt: string, scriptType: ScriptType): string {
  return `Generate a ${scriptType === "test" ? "test" : "pre-request"} script that: ${prompt}`;
}
