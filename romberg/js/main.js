const drawButton = document.getElementById('draw-button');
const formulaInput = document.getElementById('formula-input');
const canvas = document.getElementById('myChart');
const ctx = canvas.getContext('2d');
let myChart;

drawButton.addEventListener('click', () => {
    const formula = formulaInput.value;
    if (formula) {
        drawGraph(formula);
    }
});

function drawGraph(formula) {
    try {
        const node = math.parse(formula);
        const compiled = node.compile();

        const xValues = [];
        const yValues = [];
        for (let x = -10; x <= 10; x += 0.1) {
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
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 2,
                    fill: false,
                    pointRadius: 0,
                    tension: 0.1
                }]
            },
            options: {
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom'
                    }
                }
            }
        });
    } catch (err) {
        alert('数式の解析に失敗しました。入力形式を確認してください。');
        console.error(err);
    }
}
