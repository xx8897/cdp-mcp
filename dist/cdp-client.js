import fs from 'fs';
import path from 'path';
export class CdpClient {
    ws;
    msgId = 1;
    callbacks = new Map();
    constructor(wsUrl) {
        this.ws = new WebSocket(wsUrl);
        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.id && this.callbacks.has(msg.id)) {
                    this.callbacks.get(msg.id)(msg);
                    this.callbacks.delete(msg.id);
                }
            }
            catch { }
        };
    }
    async connect() {
        return new Promise((resolve, reject) => {
            this.ws.onopen = () => resolve();
            this.ws.onerror = (err) => reject(err);
        });
    }
    send(method, params = {}) {
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
                }
                else {
                    resolve(res);
                }
            });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }
    close() {
        try {
            this.ws.close();
        }
        catch { }
    }
    async initSession(width, height, dpr) {
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
    async navigate(url) {
        await this.send('Page.navigate', { url });
    }
    async waitForSelector(selector, timeout = 10000) {
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
    async typeInput(inputSelector, inputValue) {
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
    async clickElement(clickSelector) {
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
    async getElementBox(selector) {
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
    async capture(outputPath, selector) {
        let clip = undefined;
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
        const screenshotParams = { format: 'png' };
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
