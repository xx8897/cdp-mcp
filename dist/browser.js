import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
// 尋找跨平台 Chrome / Edge 執行檔路徑
export function findBrowserExecutable() {
    const envPath = process.env.CHROME_PATH || process.env.BROWSER_PATH;
    if (envPath && fs.existsSync(envPath))
        return envPath;
    const platform = os.platform();
    const candidates = [];
    if (platform === 'win32') {
        const localAppData = process.env.LOCALAPPDATA || '';
        const progFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
        const progFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
        candidates.push(path.join(progFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(progFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(progFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(progFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    }
    else if (platform === 'darwin') {
        candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Chromium.app/Contents/MacOS/Chromium');
    }
    else {
        candidates.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium');
    }
    for (const candidate of candidates) {
        if (candidate && fs.existsSync(candidate)) {
            return candidate;
        }
    }
    throw new Error('未在系統中探測到 Google Chrome 或 Microsoft Edge 瀏覽器，請安裝或指定 CHROME_PATH 環境變數。');
}
/**
 * 啟動一個隔離的 Chrome CDP 無頭實例
 */
export async function launchBrowser(options = {}) {
    const { width = 1920, height = 1080, headless = true } = options;
    const browserPath = findBrowserExecutable();
    const port = Math.floor(Math.random() * 2000) + 9200;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp_mcp_'));
    const browserArgs = [
        headless ? '--headless=new' : '--auto-open-devtools-for-tabs',
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${tempDir}`,
        `--window-size=${width},${height}`,
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--run-all-compositor-stages-before-draw',
        '--hide-scrollbars'
    ];
    const browserProcess = spawn(browserPath, browserArgs, { stdio: 'ignore' });
    // 等待 CDP Debug 端口就緒
    let pages = null;
    for (let i = 0; i < 40; i++) {
        try {
            const res = await fetch(`http://127.0.0.1:${port}/json/list`);
            if (res.ok) {
                pages = await res.json();
                if (pages.length > 0)
                    break;
            }
        }
        catch { }
        await new Promise((r) => setTimeout(r, 150));
    }
    if (!pages || pages.length === 0) {
        browserProcess.kill('SIGKILL');
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        catch { }
        throw new Error(`無法連接 Chrome CDP 端口 127.0.0.1:${port}`);
    }
    let wsUrl = pages[0]?.webSocketDebuggerUrl;
    if (!wsUrl) {
        const newPageRes = await fetch(`http://127.0.0.1:${port}/json/new`, { method: 'PUT' });
        const newPage = await newPageRes.json();
        wsUrl = newPage.webSocketDebuggerUrl;
    }
    const cleanup = async () => {
        try {
            browserProcess.kill('SIGKILL');
        }
        catch { }
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        catch { }
    };
    return {
        process: browserProcess,
        port,
        tempDir,
        wsUrl,
        cleanup
    };
}
