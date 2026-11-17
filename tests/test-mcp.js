import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

async function runTest() {
  console.log('🧪 開始測試 cdp-mcp Stdio MCP 協議通訊...');

  const serverPath = path.resolve('dist/index.js');
  const serverProcess = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'inherit']
  });

  let msgId = 1;

  function sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      const payload = JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params
      }) + '\n';

      const onData = (data) => {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.id === id) {
              serverProcess.stdout.off('data', onData);
              resolve(parsed);
              return;
            }
          } catch {}
        }
      };

      serverProcess.stdout.on('data', onData);
      serverProcess.stdin.write(payload);

      setTimeout(() => {
        serverProcess.stdout.off('data', onData);
        reject(new Error(`請求超時: ${method}`));
      }, 30000);
    });
  }

  try {
    // 1. 初始化連線
    console.log('1️⃣ 發送 initialize 請求...');
    const initRes = await sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' }
    });
    console.log('✅ 初始化成功:', initRes.result?.serverInfo);

    // 2. 查詢可用工具清單
    console.log('2️⃣ 查詢 tools/list...');
    const toolsRes = await sendRequest('tools/list');
    const toolNames = toolsRes.result?.tools?.map((t) => t.name);
    console.log('✅ 工具清單:', toolNames);

    if (!toolNames.includes('take_screenshot') || !toolNames.includes('interact_and_screenshot')) {
      throw new Error('缺少核心工具！');
    }

    // 3. 執行實體截圖測試 (使用 about:blank 或 inline data URI 快速測試)
    console.log('3️⃣ 呼叫 take_screenshot 測試...');
    const testOutputPath = path.resolve('tests/output/test_sample.png');
    
    // 建立一個簡單的測試 HTML 檔案
    const testHtmlPath = path.resolve('tests/fixture.html');
    fs.mkdirSync(path.dirname(testHtmlPath), { recursive: true });
    fs.writeFileSync(testHtmlPath, `
      <!DOCTYPE html>
      <html>
        <head><title>CDP-MCP Test</title></head>
        <body style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
          <div id="test-card" style="background: rgba(255,255,255,0.2); padding: 40px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); text-align: center;">
            <h1 style="margin: 0 0 10px 0;">🚀 CDP-MCP 實機驗收成功</h1>
            <p style="margin: 0;">Zero-Dependency High-Precision Screenshot Engine</p>
          </div>
        </body>
      </html>
    `);

    const fileUrl = `file:///${testHtmlPath.replace(/\\/g, '/')}`;

    const toolCallRes = await sendRequest('tools/call', {
      name: 'take_screenshot',
      arguments: {
        url: fileUrl,
        outputPath: testOutputPath,
        selector: '#test-card',
        delay: 300,
        width: 1280,
        height: 720
      }
    });

    console.log('✅ 截圖結果回應:', toolCallRes.result?.content?.[0]?.text);

    // 4. 驗證輸出檔案
    if (fs.existsSync(testOutputPath)) {
      const stats = fs.statSync(testOutputPath);
      console.log(`🎉 實體 PNG 驗證成功！檔案路徑: ${testOutputPath}，大小: ${stats.size} bytes`);
    } else {
      throw new Error(`截圖檔案未成功生成於: ${testOutputPath}`);
    }

  } finally {
    serverProcess.kill();
  }
}

runTest().catch((err) => {
  console.error('❌ 測試失敗:', err);
  process.exit(1);
});
