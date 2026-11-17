import { launchBrowser } from "../browser.js";
import { CdpClient } from "../cdp-client.js";
export const interactAndScreenshotSchema = {
    name: "interact_and_screenshot",
    description: "Simulate user input (with React/Vue controlled component penetration) and/or button click on a webpage, then capture a screenshot.",
    inputSchema: {
        type: "object",
        properties: {
            url: {
                type: "string",
                description: "Target webpage URL"
            },
            outputPath: {
                type: "string",
                description: "Path where the PNG screenshot should be saved"
            },
            inputSelector: {
                type: "string",
                description: "CSS selector of an input/textarea to inject text into"
            },
            inputValue: {
                type: "string",
                description: "Text value to type into the input field"
            },
            clickSelector: {
                type: "string",
                description: "CSS selector of an element to click (e.g. submit button, tab, drawer toggle)"
            },
            selector: {
                type: "string",
                description: "Optional CSS selector to crop to"
            },
            waitFor: {
                type: "string",
                description: "Optional CSS selector to wait for before interactions"
            },
            delay: {
                type: "number",
                description: "Additional delay in milliseconds after interactions (default: 1000)"
            },
            width: {
                type: "number",
                description: "Viewport width in pixels (default: 1920)"
            },
            height: {
                type: "number",
                description: "Viewport height in pixels (default: 1080)"
            },
            dpr: {
                type: "number",
                description: "Device scale factor (default: 1)"
            }
        },
        required: ["url", "outputPath"]
    }
};
export async function executeInteractAndScreenshot(args) {
    const { url, outputPath, inputSelector, inputValue, clickSelector, selector, waitFor, delay = 1000, width = 1920, height = 1080, dpr = 1 } = args;
    const browser = await launchBrowser({ width, height });
    const client = new CdpClient(browser.wsUrl);
    try {
        await client.connect();
        await client.initSession(width, height, dpr);
        await client.navigate(url);
        if (waitFor) {
            await client.waitForSelector(waitFor);
        }
        // 表單輸入注入
        let typed = false;
        if (inputSelector && inputValue !== undefined) {
            typed = await client.typeInput(inputSelector, inputValue);
            await new Promise((r) => setTimeout(r, 400));
        }
        // 元素點擊
        let clicked = false;
        if (clickSelector) {
            clicked = await client.clickElement(clickSelector);
            await new Promise((r) => setTimeout(r, 500));
        }
        if (delay > 0) {
            await new Promise((r) => setTimeout(r, delay));
        }
        const { path: savedPath, size, clip } = await client.capture(outputPath, selector);
        return JSON.stringify({
            status: "success",
            savedPath,
            fileSizeBytes: size,
            interactionResults: {
                typedInput: inputSelector ? { selector: inputSelector, value: inputValue, success: typed } : null,
                clickedElement: clickSelector ? { selector: clickSelector, success: clicked } : null
            },
            croppedElement: selector || null,
            clipBox: clip || null,
            message: `Interaction completed and screenshot saved to ${savedPath}`
        }, null, 2);
    }
    finally {
        client.close();
        await browser.cleanup();
    }
}
