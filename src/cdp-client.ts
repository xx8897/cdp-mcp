import fs from 'fs';
import path from 'path';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenshotOptions {
  url: string;
  outputPath: string;
  selector?: string;
  waitFor?: string;
  delay?: number;
  width?: number;
  height?: number;
  dpr?: number;
}

export interface InteractOptions extends ScreenshotOptions {
  clickSelector?: string;
  inputSelector?: string;
  inputValue?: string;
}

export class CdpClient {
  private ws: WebSocket;
  private msgId = 1;
  private callbacks = new Map<number, (res: any) => void>();

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
    this.ws.onmessage = (event: any) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          this.callbacks.get(msg.id)!(msg);
          this.callbacks.delete(msg.id);
        }
      } catch {}
    };
  }

  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
    });
  }

  public send(method: string, params: Record<string, any> = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      const timer = setTimeout(() => {
        this.callbacks.delete(id);
        reject(new Error(`Timeout waiting for CDP ${method}`));
      }, 20000);

      this.callbacks.set(id, (res) => {
        clearTimeout(timer);
        if (res.error) {
          reject(new Error(`CDP ${method} Error: ${JSON.stringify(res.error)}`));
        } else {
          resolve(res);
        }
      });

      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  public close(): void {
    try {
      this.ws.close();
    } catch {}
  }

  public async initSession(width: number, height: number, dpr: number): Promise<void> {
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    if (dpr !== 1) {
      await this.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: dpr,
        mobile: false
      });
    }
  }

  public async navigate(url: string): Promise<void> {
    await this.send('Page.navigate', { url });
  }

  public async waitForSelector(selector: string, timeout = 10000): Promise<boolean> {
    const script = `
      new Promise((resolve, reject) => {
        if (document.querySelector(${JSON.stringify(selector)})) return resolve(true);
        const obs = new MutationObserver(() => {
          if (document.querySelector(${JSON.stringify(selector)})) {
            obs.disconnect();
            resolve(true);
          }
        });
        obs.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => {
          obs.disconnect();
          reject(new Error('Selector timeout: ' + ${JSON.stringify(selector)}));
        }, ${timeout});
      })
    `;
    await this.send('Runtime.evaluate', { expression: script, awaitPromise: true });
    return true;
  }

  public async typeInput(inputSelector: string, inputValue: string): Promise<boolean> {
    const inputScript = `
      (() => {
        const input = document.querySelector(${JSON.stringify(inputSelector)});
        if (!input) return false;
        input.focus();
        const proto = window.HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
        if (descriptor && descriptor.set) {
          descriptor.set.call(input, ${JSON.stringify(inputValue)});
        } else {
          input.value = ${JSON.stringify(inputValue)};
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()
    `;
    const res = await this.send('Runtime.evaluate', { expression: inputScript, returnByValue: true });
    return !!res.result?.result?.value;
  }

  public async clickElement(clickSelector: string): Promise<boolean> {
    const clickScript = `
      (() => {
        const btn = document.querySelector(${JSON.stringify(clickSelector)});
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      })()
    `;
    const res = await this.send('Runtime.evaluate', { expression: clickScript, returnByValue: true });
    return !!res.result?.result?.value;
  }

  public async getElementBox(selector: string): Promise<{ exists: boolean; box: BoundingBox | null; isVisible: boolean }> {
    const rectScript = `
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return { exists: false, box: null, isVisible: false };
        const r = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && r.width > 0 && r.height > 0;
        return {
          exists: true,
          box: { x: r.x, y: r.y, width: r.width, height: r.height },
          isVisible
        };
      })()
    `;
    const evalRes = await this.send('Runtime.evaluate', { expression: rectScript, returnByValue: true });
    return evalRes.result?.result?.value || { exists: false, box: null, isVisible: false };
  }

  public async capture(outputPath: string, selector?: string): Promise<{ path: string; size: number; clip?: BoundingBox }> {
    let clip: BoundingBox | undefined = undefined;

    if (selector) {
      const { box } = await this.getElementBox(selector);
      if (box && box.width > 0 && box.height > 0) {
        clip = {
          x: Math.max(0, box.x),
          y: Math.max(0, box.y),
          width: Math.ceil(box.width),
          height: Math.ceil(box.height)
        };
      }
    }

    const screenshotParams: Record<string, any> = { format: 'png' };
    if (clip) {
      screenshotParams.clip = { ...clip, scale: 1 };
    }

    const result = await this.send('Page.captureScreenshot', screenshotParams);
    const buffer = Buffer.from(result.result.data, 'base64');

    const resolvedPath = path.resolve(process.cwd(), outputPath);
    const outDir = path.dirname(resolvedPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    fs.writeFileSync(resolvedPath, buffer);
    return { path: resolvedPath, size: buffer.length, clip };
  }
}
