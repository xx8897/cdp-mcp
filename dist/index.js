/**
 * Copyright 2026 xx8897 and cdp-mcp contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { takeScreenshotSchema, executeTakeScreenshot } from "./tools/screenshot.js";
import { interactAndScreenshotSchema, executeInteractAndScreenshot } from "./tools/interact.js";
import { inspectElementSchema, executeInspectElement } from "./tools/inspect.js";
// 建立 CDP MCP Server 實例
const server = new Server({
    name: "cdp-mcp",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
// 回報所有可用的 Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            takeScreenshotSchema,
            interactAndScreenshotSchema,
            inspectElementSchema,
        ],
    };
});
// 分派 Tool 呼叫至對應的實作函式
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        let result;
        switch (name) {
            case "take_screenshot":
                result = await executeTakeScreenshot(args);
                break;
            case "interact_and_screenshot":
                result = await executeInteractAndScreenshot(args);
                break;
            case "inspect_element":
                result = await executeInspectElement(args);
                break;
            default:
                throw new Error(`未知的工具名稱: ${name}`);
        }
        return {
            content: [
                {
                    type: "text",
                    text: result,
                },
            ],
        };
    }
    catch (error) {
        return {
            isError: true,
            content: [
                {
                    type: "text",
                    text: `[CDP-MCP Error] ${error.message || String(error)}`,
                },
            ],
        };
    }
});
// 啟動 Stdio 傳輸通道
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("🚀 CDP MCP Server 已成功啟動，監聽 Stdio 通道中...");
}
main().catch((error) => {
    console.error("❌ CDP MCP Server 啟動失敗:", error);
    process.exit(1);
});
