import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { launchBrowser } from "../browser.js";
import { CdpClient, ScreenshotOptions } from "../cdp-client.js";

export const takeScreenshotSchema: Tool = {
  name: "take_screenshot",
  description: "Capture a pixel-perfect fullpage or element-level screenshot of a webpage using real Chrome/Edge CDP without Puppeteer/Playwright dependencies.",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "Target webpage URL (e.g. http://localhost:3000 or https://example.com)"
      },
      outputPath: {
        type: "string",
        description: "Path where the PNG screenshot should be saved (e.g. ./docs/screenshots/overview.png)"
      },
      selector: {
        type: "string",
        description: "Optional CSS selector to crop precisely to a specific DOM element (e.g. #header, .modal-card)"
      },
      waitFor: {
        type: "string",
        description: "Optional CSS selector to wait for before taking screenshot"
      },
      delay: {
        type: "number",
        description: "Additional delay in milliseconds after load to ensure animations/fonts finish (default: 1000)"
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
        description: "Device scale factor. Set to 2 for Retina/HiDPI display (default: 1)"
      }
    },
    required: ["url", "outputPath"]
  }
};

export async function executeTakeScreenshot(args: ScreenshotOptions): Promise<string> {
  const {
    url,
    outputPath,
    selector,
    waitFor,
    delay = 1000,
    width = 1920,
    height = 1080,
    dpr = 1
  } = args;

  const browser = await launchBrowser({ width, height });
  const client = new CdpClient(browser.wsUrl);

  try {
    await client.connect();
    await client.initSession(width, height, dpr);
    await client.navigate(url);

    if (waitFor) {
      await client.waitForSelector(waitFor);
    }

    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }

    const { path: savedPath, size, clip } = await client.capture(outputPath, selector);

    return JSON.stringify({
      status: "success",
      savedPath,
      fileSizeBytes: size,
      croppedElement: selector || null,
      clipBox: clip || null,
      message: `Screenshot successfully captured and saved to ${savedPath} (${size} bytes)`
    }, null, 2);

  } finally {
    client.close();
    await browser.cleanup();
  }
}
