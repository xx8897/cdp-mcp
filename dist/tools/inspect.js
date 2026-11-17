import { launchBrowser } from "../browser.js";
import { CdpClient } from "../cdp-client.js";
export const inspectElementSchema = {
    name: "inspect_element",
    description: "Inspect a DOM element on a webpage via CDP: check if it exists, its computed physical bounding box (x, y, width, height), and whether it is currently visible.",
    inputSchema: {
        type: "object",
        properties: {
            url: {
                type: "string",
                description: "Target webpage URL"
            },
            selector: {
                type: "string",
                description: "CSS selector of the DOM element to inspect"
            },
            waitFor: {
                type: "string",
                description: "Optional CSS selector to wait for before inspecting"
            },
            delay: {
                type: "number",
                description: "Delay in milliseconds before inspecting (default: 500)"
            },
            width: {
                type: "number",
                description: "Viewport width in pixels (default: 1920)"
            },
            height: {
                type: "number",
                description: "Viewport height in pixels (default: 1080)"
            }
        },
        required: ["url", "selector"]
    }
};
export async function executeInspectElement(args) {
    const { url, selector, waitFor, delay = 500, width = 1920, height = 1080 } = args;
    const browser = await launchBrowser({ width, height });
    const client = new CdpClient(browser.wsUrl);
    try {
        await client.connect();
        await client.initSession(width, height, 1);
        await client.navigate(url);
        if (waitFor) {
            await client.waitForSelector(waitFor);
        }
        if (delay > 0) {
            await new Promise((r) => setTimeout(r, delay));
        }
        const inspectResult = await client.getElementBox(selector);
        return JSON.stringify({
            status: "success",
            url,
            selector,
            ...inspectResult
        }, null, 2);
    }
    finally {
        client.close();
        await browser.cleanup();
    }
}
