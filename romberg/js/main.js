// --- Setup ---
const formulaInput = document.getElementById('formula-input');
const drawButton = document.getElementById('draw-button');
const calculateButton = document.getElementById('calculate-button');
const runRombergButton = document.getElementById('run-romberg-button');

const lowerBoundInput = document.getElementById('lower-bound');
const upperBoundInput = document.getElementById('upper-bound');
const divisionsInput = document.getElementById('divisions');
const trueValueInput = document.getElementById('true-value');

const integralResult = document.getElementById('integral-result');
const rombergResultArea = document.getElementById('romberg-result-area');

const canvas = document.getElementById('myChart');
const ctx = canvas.getContext('2d');
let myChart;

// Set precision for decimal.js. 30 is more than enough for 20-digit display.
Decimal.set({ precision: 30 });

// --- Chart.js Plugins ---
const trapezoidPlugin = {
    id: 'trapezoidPlugin',
    afterDatasetsDraw: (chart, args, options) => {
        const { ctx, scales: { x, y } } = chart;
        const { a, b, n, func } = options;

        if (!func || a === undefined || b === undefined || !n || n <= 0) {
            return;
        }

        ctx.save();
        const h = (b - a) / n;

        for (let i = 0; i < n; i++) {
            const x1 = a + i * h;
            const x2 = a + (i + 1) * h;
            const y1 = func(x1);
            const y2 = func(x2);

            const pixelX1 = x.getPixelForValue(x1);
            const pixelX2 = x.getPixelForValue(x2);
            const pixelY0 = y.getPixelForValue(0);
            const pixelY1 = y.getPixelForValue(y1);
            const pixelY2 = y.getPixelForValue(y2);

            ctx.beginPath();
            ctx.moveTo(pixelX1, pixelY0);
            ctx.lineTo(pixelX1, pixelY1);
            ctx.lineTo(pixelX2, pixelY2);
            ctx.lineTo(pixelX2, pixelY0);
            ctx.closePath();
            
            ctx.fillStyle = 'rgba(0, 123, 255, 0.2)';
            ctx.strokeStyle = 'rgba(0, 123, 255, 1)';
            ctx.lineWidth = 1;
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    }
};
Chart.register(trapezoidPlugin);

const axesPlugin = {
    id: 'axesPlugin',
    afterDraw: (chart) => {
        const { ctx, chartArea: { left, right, top, bottom }, scales: { x, y } } = chart;
        ctx.save();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#333';

        const x0 = x.getPixelForValue(0);
        if (x0 >= left && x0 <= right) {
            ctx.beginPath();
            ctx.moveTo(x0, bottom);
            ctx.lineTo(x0, top);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x0 - 6, top + 8);
            ctx.lineTo(x0, top);
            ctx.lineTo(x0 + 6, top + 8);
            ctx.stroke();
            ctx.fillText('y', x0 - 20, top + 15);
        }

        const y0 = y.getPixelForValue(0);
        if (y0 >= top && y0 <= bottom) {
            ctx.beginPath();
            ctx.moveTo(left, y0);
            ctx.lineTo(right, y0);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(right - 8, y0 - 6);
            ctx.lineTo(right, y0);
            ctx.lineTo(right - 8, y0 + 6);
            ctx.stroke();
            ctx.fillText('x', right - 15, y0 + 20);
        }
        ctx.restore();
    }
};
Chart.register(axesPlugin);

// --- Event Listeners ---
drawButton.addEventListener('click', () => {
    const formula = formulaInput.value;
    if (formula) {
        drawGraph(formula);
    }
});

calculateButton.addEventListener('click', () => {
    const formula = formulaInput.value;
    const lowerBoundStr = lowerBoundInput.value || '0';
    const upperBoundStr = upperBoundInput.value || '0';
    const divisions = parseInt(divisionsInput.value, 10);
    const trueValueStr = trueValueInput.value || null;

    if (!formula || isNaN(divisions) || divisions <= 0) {
        alert('数式、有効な積分範囲、正の分割数を入力してください。');
        return;
    }
    if (divisions > 1024){
        alert('分割数の最大値は1024です');
        return;
    }

    try {
        const node = math.parse(formula);
        const compiled = node.compile();
        // Wrapper function for high-precision calculations
        const func = (x) => new Decimal(compiled.evaluate({ x: x.toString() }));

        const lowerBound = new Decimal(math.evaluate(lowerBoundStr).toString());
        const upperBound = new Decimal(math.evaluate(upperBoundStr).toString());
        const trueValue = trueValueStr ? new Decimal(math.evaluate(trueValueStr).toString()) : null;

        // 1. Draw graph (uses standard numbers for visualization)
        drawGraph(formula, {
            a: lowerBound.toNumber(),
            b: upperBound.toNumber(),
            n: divisions,
            func: (x) => compiled.evaluate({ x: x })
        });

        // 2. Calculate integral with high precision
        const start = performance.now(); // 実行開始時間（ms）
        const result = trapezoidal(func, lowerBound, upperBound, divisions);
        const end = performance.now();   // 実行終了時間（ms）

        const elapsedSeconds = ((end - start) / 1000).toFixed(5); // 秒単位に変換

        // 3. Display result with high precision
        let output = `<div class="result-line"><span>計算結果:</span><span>${result.toFixed(20)}</span></div>`;

        if (trueValue !== null) {
            const error = result.sub(trueValue).abs();
            output += `<div class="result-line"><span>真の値:</span><span>${trueValue.toFixed(20)}</span></div>`;
            output += `<div class="result-line"><span>誤差:</span><span>${error.toFixed(20)}</span></div>`;
            output += `<div class="elapsed-time">実行時間:<span>${elapsedSeconds} s</span></div>`;
        }
        integralResult.innerHTML = output;

    } catch (err) {
        alert('計算または描画に失敗しました。数式や範囲を確認してください。');
        console.error(err);
    }
});

runRombergButton.addEventListener('click', () => {
    const formula = formulaInput.value;
    const lowerBoundStr = lowerBoundInput.value || '0';
    const upperBoundStr = upperBoundInput.value || '0';
    const trueValueStr = trueValueInput.value || null;

    if (!formula || !trueValueStr) {
        alert('ロンバーグ積分には、有効な数式、積分範囲、そして真の値の入力が必須です。');
        return;
    }

    try {
        const node = math.parse(formula);
        const compiled = node.compile();
        const func = (x) => new Decimal(compiled.evaluate({ x: x.toString() }));
        
        const lowerBound = new Decimal(math.evaluate(lowerBoundStr).toString());
        const upperBound = new Decimal(math.evaluate(upperBoundStr).toString());
        const trueValue = new Decimal(math.evaluate(trueValueStr).toString());

        const start = performance.now();
        const history = romberg(func, lowerBound, upperBound, trueValue);
        const end = performance.now();
        
        const elapsedSeconds = ((end - start) / 1000).toFixed(5);

        let tableHTML = `<table class="convergence-table"><thead><tr><th>分割数 (n)</th><th>近似値</th><th>誤差 (真値との差)</th></tr></thead><tbody>`;

        history.forEach(row => {
            tableHTML += `
                <tr>
                    <td>${row.n}</td>
                    <td>${row.approximation.toFixed(20)}</td>
                    <td>${row.error.toFixed(20)}</td>
                </tr>
            `;
        });

        tableHTML += `</tbody></table>`;
        tableHTML += `<div class="elapsed-time">実行時間:<span>${elapsedSeconds} s</span></div>`;
        rombergResultArea.innerHTML = tableHTML;

    } catch (err) {
        alert('ロンバーグ積分の計算に失敗しました。');
        console.error(err);
    }
});

// --- Core Functions ---

function drawGraph(formula, integrationParams = null) {
    try {
        // Show graph, hide placeholder
        document.getElementById('graph-placeholder').style.display = 'none';
        document.getElementById('myChart').style.display = 'block';
        const graphArea = document.querySelector('.graph-area');
        graphArea.style.background = 'transparent';
        graphArea.style.border = 'none';
        graphArea.style.minHeight = 'auto';

        const node = math.parse(formula);
        const compiled = node.compile();

        let minX = -10;
        let maxX = 10;
        if (integrationParams) {
            const range = Math.abs(integrationParams.b - integrationParams.a);
            minX = Math.min(integrationParams.a, integrationParams.b) - range * 0.1 - 1;
            maxX = Math.max(integrationParams.a, integrationParams.b) + range * 0.1 + 1;
        }

        const xValues = [];
        const yValues = [];
        const step = (maxX - minX) / 400;
        for (let x = minX; x <= maxX; x += step) {
            xValues.push(x);
            yValues.push(compiled.evaluate({ x: x }));
        }

        if (myChart) {
            myChart.destroy();
        }

        myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: xValues,
                datasets: [{
                    label: formula,
                    data: yValues,
                    borderColor: '#007bff',
                    borderWidth: 2,
                    fill: false,
                    pointRadius: 0,
                    tension: 0.1
                }]
            },
            options: {
                scales: { x: { type: 'linear', position: 'bottom', min: minX, max: maxX }, y: { beginAtZero: false } },
                plugins: { trapezoidPlugin: integrationParams || {} }
            }
        });
    } catch (err) {
        alert('数式の解析またはグラフの描画に失敗しました。');
        console.error(err);
    }
}

// --- High-Precision Calculation Functions ---

function trapezoidal(f, a, b, n) {
    const h = b.sub(a).div(n);
    let sum = f(a).add(f(b)).div(2);
    for (let i = 1; i < n; i++) {
        const x = a.add(h.mul(i));
        sum = sum.add(f(x));
    }
    return sum.mul(h);
}

function romberg(f, a, b, trueValue, max_steps = 11) {
    let R = Array(max_steps).fill(0).map(() => Array(max_steps).fill(0));
    let h = b.sub(a);
    R[0][0] = f(a).add(f(b)).mul(h).div(2);

    let history = [{
        n: 1,
        approximation: R[0][0],
        error: R[0][0].sub(trueValue).abs()
    }];

    const four = new Decimal(4);

    for (let i = 1; i < max_steps; i++) {
        h = h.div(2);
        let sum = new Decimal(0);
        const limit = Math.pow(2, i);
        for (let k = 1; k < limit; k += 2) {
            sum = sum.add(f(a.add(h.mul(k))));
        }
        R[i][0] = R[i - 1][0].div(2).add(sum.mul(h));

        for (let j = 1; j <= i; j++) {
            const powerOf4 = four.pow(j);
            R[i][j] = R[i][j - 1].add(
                R[i][j - 1].sub(R[i - 1][j - 1]).div(powerOf4.sub(1))
            );
        }

        history.push({
            n: limit,
            approximation: R[i][i],
            error: R[i][i].sub(trueValue).abs()
        });
    }
    return history;
}
