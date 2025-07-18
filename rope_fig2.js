const svg = d3.select("#rope1d");
const width = +svg.attr("width");
const height = +svg.attr("height");
const margin = { top: 10, right: 10, bottom: 20, left: 40 };
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

const xScale = d3.scaleLinear().domain([-1, 1]).range([0, innerWidth]);
const yScale = d3.scaleLinear().domain([-0.25, 1.05]).range([innerHeight, 0]);

const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

// gridlines
const xGrid = d3.axisBottom(xScale)
    .tickSize(-innerHeight)
    .tickFormat("");

const yGrid = d3.axisLeft(yScale)
    .tickSize(-innerWidth)
    .tickFormat("");

g.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(xGrid);

g.append("g")
    .attr("class", "grid")
    .call(yGrid);

const xAxis = d3.axisBottom(xScale).ticks(10);
const yAxis = d3.axisLeft(yScale);

g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(xAxis);

g.append("g")
    .attr("class", "axis")
    .call(yAxis);

const linePath = g.append("path")
    .attr("fill", "none")
    .attr("stroke", "black")
    .attr("stroke-width", 2);

function linspace(start, end, num) {
    const arr = [];
    if (num == 1) {
        arr.push(start);
        return arr;
    }
    for (let i = 0; i < num; i++) {
        arr.push(start + (end - start) * (i / (num - 1)));
    }
    return arr;
}

function computeAlignment(minFreq, maxFreq, nFreqs) {
    // const thetaVals = linspace(0, 2 * Math.PI, 200);
    const thetaVals = linspace(-1, 1, 301);
    const x = Array(nFreqs).fill(0).flatMap(() => [1, 0]);
    const ws = linspace(0, 1, nFreqs).map(i => minFreq * Math.pow(maxFreq / minFreq, i));

    return thetaVals.map(theta => {
        const y = ws.flatMap(w => [Math.cos(w * theta), Math.sin(w * theta)]);
        const dot = d3.sum(d3.range(2 * nFreqs).map(i => x[i] * y[i]));
        const normY = Math.sqrt(d3.sum(y.map(v => v * v)));
        const alignment = dot / (Math.sqrt(nFreqs) * normY);
        return { theta, alignment };
    });
}

function computeSpeed(minFreq, maxFreq, nFreqs) {
    const ws = linspace(0, 1, nFreqs).map(i => minFreq * Math.pow(maxFreq, i));

    let ret = 0.0;
    for (let i = 0; i < ws.length; i++) {
        ret += ws[i] * ws[i];
    }
    return Math.sqrt(ret / ws.length);
}

function updatePlot() {
    const minFreq = parseFloat(document.getElementById("minFreq").value);
    const maxFreq = parseFloat(document.getElementById("maxFreq").value);

    const nFreqs = parseInt(document.getElementById("nFreqs").value);

    document.getElementById("minFreqVal").value = minFreq;
    document.getElementById("maxFreqVal").value = maxFreq;
    document.getElementById("nFreqsVal").value = nFreqs;

    const data = computeAlignment(minFreq, maxFreq, nFreqs);

    const lineGen = d3.line()
        .x(d => xScale(d.theta))
        .y(d => yScale(d.alignment));

    linePath.datum(data).attr("d", lineGen);

    // document.getElementById("rope1dspeed").innerText = "rotation speed: " + computeSpeed(minFreq, maxFreq, nFreqs).toFixed(3);
}

function syncInputs(idRange, idInput, parseFn = parseFloat) {
    document.getElementById(idRange).addEventListener("input", () => {
        document.getElementById(idInput).value = document.getElementById(idRange).value;
        updatePlot();
    });

    const inputElem = document.getElementById(idInput);

    inputElem.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            document.getElementById(idRange).value = inputElem.value;
            updatePlot();
        }
    });

    inputElem.addEventListener("blur", () => {
        document.getElementById(idRange).value = inputElem.value;
        updatePlot();
    });

    inputElem.addEventListener("change", () => {
        document.getElementById(idRange).value = inputElem.value;
        updatePlot();
    });
}

syncInputs("minFreq", "minFreqVal", parseFloat);
syncInputs("maxFreq", "maxFreqVal", parseFloat);
syncInputs("nFreqs", "nFreqsVal", parseInt);

updatePlot();