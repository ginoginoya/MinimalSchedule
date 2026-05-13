const colLeft = document.getElementById('col-left');
const colRight = document.getElementById('col-right');
const container = document.querySelector('.container');
const testAlphaInput = document.getElementById('test-alpha');
const themeSelect = document.getElementById('theme-select');
const tasks = [];
const sleep = ms => new Promise(res => setTimeout(res, ms));

// 初始化 24 個任務項與設定
async function init() {
    if (typeof RainmeterAPI === 'undefined') {
        setTimeout(init, 100);
        return;
    }

    // 1. 讀取並套用主題與透明度設定
    try {
        const savedTheme = await RainmeterAPI.GetVariable('Theme');
        const savedAlpha = await RainmeterAPI.GetVariable('Alpha');

        if (savedTheme) {
            container.setAttribute('data-theme', savedTheme);
            if (themeSelect) themeSelect.value = savedTheme;
        }

        if (savedAlpha && testAlphaInput) {
            testAlphaInput.value = savedAlpha;
            updateOpacity(savedAlpha);
        }

        // 3. 讀取釘選狀態
        const savedPinned = await RainmeterAPI.GetVariable('Pinned');
        if (savedPinned === '1') {
            isPinned = true;
            await RainmeterAPI.Bang('[!ZPos 2]');
            const btn = document.getElementById('btn-pin');
            if (btn) {
                btn.classList.add('active');
                btn.querySelector('.icon-unpinned').style.display = 'none';
                btn.querySelector('.icon-pinned').style.display = 'block';
            }
        }
    } catch (e) {
        console.error('Failed to load settings', e);
    }

    // 2. 初始化任務清單
    colLeft.innerHTML = '';
    colRight.innerHTML = '';

    for (let i = 0; i < 24; i++) {
        const item = document.createElement('div');
        item.className = 'task-item';
        item.id = `item-${i}`;
        const timeStr = i.toString().padStart(2, '0') + ':00';

        item.innerHTML = `
            <div class="task-time">${timeStr}</div>
            <input type="text" class="task-content" id="input-${i}" placeholder="輸入任務..." spellcheck="false">
            <div class="checkbox-container" id="check-${i}"></div>
        `;

        if (i < 12) colLeft.appendChild(item);
        else colRight.appendChild(item);

        const input = item.querySelector(`#input-${i}`);
        const check = item.querySelector(`#check-${i}`);

        input.addEventListener('change', (e) => saveData(i, 'Task', e.target.value));
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); e.stopPropagation(); });
        input.addEventListener('click', (e) => e.stopPropagation());
        check.addEventListener('click', () => toggleStatus(i));

        try {
            const taskVal = await RainmeterAPI.GetVariable(`Task${i}`);
            const statusVal = await RainmeterAPI.GetVariable(`Status${i}`);
            input.value = taskVal || '';
            if (statusVal === '1') item.classList.add('done');
        } catch (e) { }

        tasks.push({ input, item });
    }


}

// 通用的透明度更新函數
function updateOpacity(val) {
    const opacity = Math.min(100, Math.max(0, val)) / 100;
    container.style.backgroundColor = `rgba(var(--bg-r), var(--bg-g), var(--bg-b), ${opacity})`;
}

// 儲存資料到 Rainmeter
async function saveData(id, type, value) {
    try {
        const path = await RainmeterAPI.ReplaceVariables('#CURRENTPATH#DataWeb.inc');
        const bang = `[!WriteKeyValue Variables ${type}${id} "${value}" "${path}"][!SetVariable ${type}${id} "${value}"]`;
        await RainmeterAPI.Bang(bang);
    } catch (e) {
        console.error('Save failed:', e);
    }
}

// 儲存設定 (主題、透明度)
async function saveSetting(name, value) {
    try {
        const path = await RainmeterAPI.ReplaceVariables('#CURRENTPATH#DataWeb.inc');
        const bang = `[!WriteKeyValue Variables ${name} "${value}" "${path}"][!SetVariable ${name} "${value}"]`;
        await RainmeterAPI.Bang(bang);
    } catch (e) { }
}

// 切換完成狀態
async function toggleStatus(id) {
    const item = document.getElementById(`item-${id}`);
    const isDone = item.classList.toggle('done');
    const statusVal = isDone ? '1' : '0';
    await saveData(id, 'Status', statusVal);
    await RainmeterAPI.Bang('[!UpdateMeasure *][!Redraw]');
}

// 透明度測試邏輯
if (testAlphaInput) {
    testAlphaInput.addEventListener('input', (e) => {
        updateOpacity(e.target.value);
    });

    testAlphaInput.addEventListener('wheel', (e) => {
        e.preventDefault();
        let val = parseInt(testAlphaInput.value) || 100;
        val = e.deltaY < 0 ? val + 5 : val - 5;
        val = Math.min(100, Math.max(10, val));
        testAlphaInput.value = val;
        updateOpacity(val);
        saveSetting('Alpha', val);
    }, { passive: false });

    const validateAndFix = () => {
        let val = parseInt(testAlphaInput.value);
        if (isNaN(val) || val < 0 || val > 100) {
            val = 100;
            testAlphaInput.value = val;
            updateOpacity(val);
        }
        saveSetting('Alpha', val);
    };
    testAlphaInput.addEventListener('change', validateAndFix);
    testAlphaInput.addEventListener('blur', validateAndFix);
}

// 主題切換邏輯
if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
        const theme = e.target.value;
        container.setAttribute('data-theme', theme);
        if (testAlphaInput) {
            updateOpacity(testAlphaInput.value);
        }
        saveSetting('Theme', theme);
    });
}

// 清除功能
document.getElementById('btn-clear-text').addEventListener('click', async () => {
    if (confirm('確定要清除所有文字內容嗎？')) {
        const path = await RainmeterAPI.ReplaceVariables('#CURRENTPATH#DataWeb.inc');
        let bang = '';
        for (let i = 0; i < 24; i++) {
            document.getElementById(`input-${i}`).value = '';
            bang += `[!WriteKeyValue Variables Task${i} "" "${path}"][!SetVariable Task${i} ""]`;
        }
        await RainmeterAPI.Bang(bang + '[!UpdateMeasure *][!Redraw]');
    }
});

document.getElementById('btn-clear-status').addEventListener('click', async () => {
    if (confirm('確定要清除所有勾選標記嗎？')) {
        const path = await RainmeterAPI.ReplaceVariables('#CURRENTPATH#DataWeb.inc');
        let bang = '';
        for (let i = 0; i < 24; i++) {
            document.getElementById(`item-${i}`).classList.remove('done');
            bang += `[!WriteKeyValue Variables Status${i} "0" "${path}"][!SetVariable Status${i} "0"]`;
        }
        await RainmeterAPI.Bang(bang + '[!UpdateMeasure *][!Redraw]');
    }
});



// 視窗控制按鈕邏輯
let isMaximized = false;
let isFolded = false;
let isPinned = false;

document.getElementById('btn-close').addEventListener('click', async () => {
    if (typeof RainmeterAPI !== 'undefined') {
        await RainmeterAPI.Bang('[!DeactivateConfig]');
    }
});

// 釘選功能實作
document.getElementById('btn-pin').addEventListener('click', async () => {
    if (typeof RainmeterAPI === 'undefined') return;

    const btn = document.getElementById('btn-pin');
    const iconUnpinned = btn.querySelector('.icon-unpinned');
    const iconPinned = btn.querySelector('.icon-pinned');
    isPinned = !isPinned;

    if (isPinned) {
        await RainmeterAPI.Bang('[!ZPos 2]');
        btn.classList.add('active');
        iconUnpinned.style.display = 'none';
        iconPinned.style.display = 'block';
        saveSetting('Pinned', '1');
    } else {
        await RainmeterAPI.Bang('[!ZPos 0]');
        btn.classList.remove('active');
        iconUnpinned.style.display = 'block';
        iconPinned.style.display = 'none';
        saveSetting('Pinned', '0');
    }
});

// 摺疊功能實作
document.getElementById('btn-fold').addEventListener('click', async () => {
    if (typeof RainmeterAPI === 'undefined') return;

    const btn = document.getElementById('btn-fold');
    const svgIcon = btn.querySelector('svg');
    const appContainer = document.querySelector('.container');

    // 方案一：啟動淡出效果，隱藏變換過程
    appContainer.classList.add('transitioning');
    await sleep(50); // 等待 CSS transition 完成

    isFolded = !isFolded;

    if (isFolded) {
        // --- 摺疊邏輯 (展開 -> 摺疊) ---
        const foldedW = 80;
        const foldedH = 45;

        const monitorIndex = await getMonitorIndex();
        // 獲取螢幕物理區域 (SCREENAREA) 與 工作區區域 (WORKAREA)
        const sx = parseInt(await RainmeterAPI.ReplaceVariables(`#SCREENAREAX@${monitorIndex}#`));
        const sy = parseInt(await RainmeterAPI.ReplaceVariables(`#SCREENAREAY@${monitorIndex}#`));
        const sw = parseInt(await RainmeterAPI.ReplaceVariables(`#SCREENAREAWIDTH@${monitorIndex}#`));
        const sh = parseInt(await RainmeterAPI.ReplaceVariables(`#SCREENAREAHEIGHT@${monitorIndex}#`));

        const wx = parseInt(await RainmeterAPI.ReplaceVariables(`#WORKAREAX@${monitorIndex}#`));
        const wy = parseInt(await RainmeterAPI.ReplaceVariables(`#WORKAREAY@${monitorIndex}#`));
        const ww = parseInt(await RainmeterAPI.ReplaceVariables(`#WORKAREAWIDTH@${monitorIndex}#`));
        const wh = parseInt(await RainmeterAPI.ReplaceVariables(`#WORKAREAHEIGHT@${monitorIndex}#`));

        const currentX = parseInt(await RainmeterAPI.ReplaceVariables('#CURRENTCONFIGX#'));
        const currentY = parseInt(await RainmeterAPI.ReplaceVariables('#CURRENTCONFIGY#'));

        const currentW = isMaximized ? sw : 980;
        const currentH = isMaximized ? sh : 900;

        let newX = currentX;
        let newY = currentY;

        const cx = currentX + currentW / 2;
        const cy = currentY + currentH / 2;
        let mx = sx + sw / 2;
        let my = sy + sh / 2;

        // 若面板完全在工作區內 (未與工具列重疊)，則以工作區中心為判斷基準
        if (currentX >= wx && currentY >= wy && currentX + currentW <= wx + ww && currentY + currentH <= wy + wh) {
            mx = wx + ww / 2;
            my = wy + wh / 2;
        }

        // 象限判定 (右半邊 / 下半邊)
        if (cx >= mx) newX = currentX + currentW - foldedW;
        if (cy >= my) newY = currentY + currentH - foldedH;

        // 確保不超出版圖 (安全性防護)
        if (newX + foldedW > sx + sw) newX = sx + sw - foldedW;
        if (newY + foldedH > sy + sh) newY = sy + sh - foldedH;
        if (newX < sx) newX = sx;
        if (newY < sy) newY = sy;

        // 第一階段：暫時關閉邊界限制，並讓面板變小
        await RainmeterAPI.Bang(`[!SetOption Rainmeter KeepOnScreen 0][!SetOption WebView2 W "${foldedW}"][!SetOption WebView2 H "${foldedH}"][!SetOption Background_Shape Shape "Rectangle 0,0,${foldedW},${foldedH} | StrokeWidth 0 | FillColor 0,0,0,1"][!UpdateMeasure WebView2][!UpdateMeter *][!Redraw]`);

        await sleep(50);

        // 第二階段：執行搬移到螢幕絕對邊緣，並恢復限制
        await RainmeterAPI.Bang(`[!Move "${newX}" "${newY}"][!SetOption Rainmeter KeepOnScreen 1][!UpdateMeter *][!Redraw]`);

        appContainer.classList.add('folded');
        document.getElementById('title').innerText = 'S';
        document.body.classList.add('folded-body');
        svgIcon.style.transform = 'rotate(180deg)';
        btn.title = '展開';
    } else {
        // --- 展開邏輯 (摺疊 -> 展開) ---
        const monitorIndex = await getMonitorIndex();
        const sx = parseInt(await RainmeterAPI.ReplaceVariables(`#SCREENAREAX@${monitorIndex}#`));
        const sy = parseInt(await RainmeterAPI.ReplaceVariables(`#SCREENAREAY@${monitorIndex}#`));
        const sw = parseInt(await RainmeterAPI.ReplaceVariables(`#SCREENAREAWIDTH@${monitorIndex}#`));
        const sh = parseInt(await RainmeterAPI.ReplaceVariables(`#SCREENAREAHEIGHT@${monitorIndex}#`));
        const wx = parseInt(await RainmeterAPI.ReplaceVariables(`#WORKAREAX@${monitorIndex}#`));
        const wy = parseInt(await RainmeterAPI.ReplaceVariables(`#WORKAREAY@${monitorIndex}#`));
        const ww = parseInt(await RainmeterAPI.ReplaceVariables(`#WORKAREAWIDTH@${monitorIndex}#`));
        const wh = parseInt(await RainmeterAPI.ReplaceVariables(`#WORKAREAHEIGHT@${monitorIndex}#`));

        const currentX = parseInt(await RainmeterAPI.ReplaceVariables('#CURRENTCONFIGX#'));
        const currentY = parseInt(await RainmeterAPI.ReplaceVariables('#CURRENTCONFIGY#'));

        let targetW = 980;
        let targetH = 900;
        let targetZoom = 1.0;

        if (isMaximized) {
            const baseW = 980;
            const baseH = 900;
            const scale = Math.min(ww / baseW, wh / baseH);
            targetW = Math.floor(baseW * scale);
            targetH = Math.floor(baseH * scale);
            targetZoom = scale;

            // 最大化展開時，先移到工作區左上角
            await RainmeterAPI.Bang(`[!SetOption Rainmeter KeepOnScreen 0][!Move "${wx}" "${wy}"][!UpdateMeter *][!Redraw]`);
        } else {
            const currentW = 80; // 摺疊狀態下的寬度
            const currentH = 45; // 摺疊狀態下的高度

            let newX = currentX;
            let newY = currentY;

            const cx = currentX + currentW / 2;
            const cy = currentY + currentH / 2;
            let mx = sx + sw / 2;
            let my = sy + sh / 2;

            // 若面板完全在工作區內 (未與工具列重疊)，則以工作區中心為判斷基準
            if (currentX >= wx && currentY >= wy && currentX + currentW <= wx + ww && currentY + currentH <= wy + wh) {
                mx = wx + ww / 2;
                my = wy + wh / 2;
            }

            // 象限判定 (右半邊 / 下半邊)
            if (cx >= mx) newX = currentX + currentW - targetW;
            if (cy >= my) newY = currentY + currentH - targetH;

            // 確保不超出版圖
            if (newX + targetW > sx + sw) newX = sx + sw - targetW;
            if (newY + targetH > sy + sh) newY = sy + sh - targetH;
            if (newX < sx) newX = sx;
            if (newY < sy) newY = sy;

            await RainmeterAPI.Bang(`[!SetOption Rainmeter KeepOnScreen 0][!Move "${newX}" "${newY}"][!UpdateMeter *][!Redraw]`);
        }

        await sleep(50);

        const sizeBang = isMaximized
            ? `[!SetOption WebView2 W "${targetW}"][!SetOption WebView2 H "${targetH}"][!SetOption WebView2 ZoomFactor "${targetZoom}"][!SetOption Background_Shape Shape "Rectangle 0,0,${targetW},${targetH} | StrokeWidth 0 | FillColor 0,0,0,1"][!SetOption Rainmeter KeepOnScreen 1][!UpdateMeasure WebView2][!UpdateMeter *][!Redraw]`
            : `[!SetOption WebView2 W "${targetW}"][!SetOption WebView2 H "${targetH}"][!SetOption Background_Shape Shape "Rectangle 0,0,${targetW},${targetH} | StrokeWidth 0 | FillColor 0,0,0,1"][!SetOption Rainmeter KeepOnScreen 1][!UpdateMeasure WebView2][!UpdateMeter *][!Redraw]`;

        await RainmeterAPI.Bang(sizeBang);

        appContainer.classList.remove('folded');
        document.getElementById('title').innerText = 'SCHEDULE';
        document.body.classList.remove('folded-body');
        svgIcon.style.transform = 'rotate(0deg)';
        btn.title = '摺疊';
    }

    // 變換完成，淡入顯示
    await sleep(50);
    appContainer.classList.remove('transitioning');
});

// 輔助函式：獲取當前螢幕索引
async function getMonitorIndex() {
    try {
        const currentX = parseInt(await RainmeterAPI.ReplaceVariables('#CURRENTCONFIGX#'));
        const currentY = parseInt(await RainmeterAPI.ReplaceVariables('#CURRENTCONFIGY#'));

        let monitorIndex = 1;
        for (let i = 1; i <= 8; i++) {
            const sx = parseInt(await RainmeterAPI.ReplaceVariables(`#SCREENAREAX@${i}#`));
            const sy = parseInt(await RainmeterAPI.ReplaceVariables(`#SCREENAREAY@${i}#`));
            const sw = parseInt(await RainmeterAPI.ReplaceVariables(`#SCREENAREAWIDTH@${i}#`));
            const sh = parseInt(await RainmeterAPI.ReplaceVariables(`#SCREENAREAHEIGHT@${i}#`));

            if (isNaN(sx) || isNaN(sw)) continue;

            if (currentX + 10 >= sx && currentX + 10 < sx + sw && currentY + 10 >= sy && currentY + 10 < sy + sh) {
                monitorIndex = i;
                break;
            }
        }
        return monitorIndex;
    } catch (e) {
        return 1;
    }
}

document.getElementById('btn-maximize').addEventListener('click', async () => {
    if (typeof RainmeterAPI === 'undefined') return;

    const btn = document.getElementById('btn-maximize');

    if (!isMaximized) {
        try {
            const monitorIndex = await getMonitorIndex();
            const ww = parseInt(await RainmeterAPI.ReplaceVariables(`#WORKAREAWIDTH@${monitorIndex}#`));
            const wh = parseInt(await RainmeterAPI.ReplaceVariables(`#WORKAREAHEIGHT@${monitorIndex}#`));
            const wx = parseInt(await RainmeterAPI.ReplaceVariables(`#WORKAREAX@${monitorIndex}#`));
            const wy = parseInt(await RainmeterAPI.ReplaceVariables(`#WORKAREAY@${monitorIndex}#`));

            const baseW = 980;
            const baseH = 900;
            let scale = Math.min(ww / baseW, wh / baseH);
            if (scale < 1) scale = 1;

            const newW = Math.floor(baseW * scale);
            const newH = Math.floor(baseH * scale);

            await RainmeterAPI.Bang(`[!Move "${wx}" "${wy}"][!SetOption WebView2 W "${newW}"][!SetOption WebView2 H "${newH}"][!SetOption WebView2 ZoomFactor "${scale}"][!UpdateMeasure WebView2][!SetOption Background_Shape Shape "Rectangle 0,0,${newW},${newH} | StrokeWidth 0 | FillColor 0,0,0,1"][!UpdateMeter *][!Redraw]`);

            container.classList.add('maximized');
            btn.innerText = '❐';
            btn.title = '還原';
            isMaximized = true;
        } catch (e) { }
    } else {
        await RainmeterAPI.Bang(`[!SetOption WebView2 W "980"][!SetOption WebView2 H "900"][!SetOption WebView2 ZoomFactor "1.0"][!UpdateMeasure WebView2][!SetOption Background_Shape Shape "Rectangle 0,0,980,900 | StrokeWidth 0 | FillColor 0,0,0,1"][!UpdateMeter *][!Redraw]`);
        container.classList.remove('maximized');
        btn.innerText = '▢';
        btn.title = '最大化';
        isMaximized = false;
    }
});

// --- 自定義拖拽邏輯 ---
let isDragging = false;
let startMouseX = 0;
let startWinX = 0;
let lockedY = 0;

const header = document.querySelector('header');
header.addEventListener('mousedown', async (e) => {
    if (isMaximized && e.button === 0) {
        isDragging = true;
        startMouseX = e.screenX;
        startWinX = parseInt(await RainmeterAPI.ReplaceVariables('#CURRENTCONFIGX#'));
        lockedY = parseInt(await RainmeterAPI.ReplaceVariables('#WORKAREAY#'));
        e.preventDefault();
    }
});

window.addEventListener('mousemove', (e) => {
    if (isDragging && isMaximized) {
        const deltaX = e.screenX - startMouseX;
        const newX = startWinX + deltaX;
        RainmeterAPI.Bang(`[!Move "${newX}" "${lockedY}"]`);
    }
});

window.addEventListener('mouseup', () => {
    isDragging = false;
});



init();
