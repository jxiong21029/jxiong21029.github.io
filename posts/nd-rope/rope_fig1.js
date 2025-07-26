function cyrb128(str) {
    let h1 = 1779033703, h2 = 3144134277,
        h3 = 1013904242, h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
        k = str.charCodeAt(i);
        h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
        h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
        h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
        h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    h1 ^= (h2 ^ h3 ^ h4), h2 ^= h1, h3 ^= h1, h4 ^= h1;
    return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}
let seed = cyrb128("my_seed")

function sfc32(a, b, c, d) {
    return function () {
        a |= 0; b |= 0; c |= 0; d |= 0;
        let t = (a + b | 0) + d | 0;
        d = d + 1 | 0;
        a = b ^ b >>> 9;
        b = c + (c << 3) | 0;
        c = (c << 21 | c >>> 11);
        c = c + t | 0;
        return (t >>> 0) / 4294967296;
    }
}

function linspace(a, b, n) {
    const arr = new Float64Array(n);
    const step = (b - a) / (n - 1);
    for (let i = 0; i < n; i++) arr[i] = a + i * step;
    return arr;
}

function computeAlignment(N, minFreq, maxFreq, nFreqs, phiSpacing) {
    const hh = linspace(-1, 1, N);
    const ww = linspace(-1, 1, N);

    let rand = sfc32(seed[0], seed[1], seed[2], seed[3]);

    function randn() {
        let u = 0, v = 0;
        while (u === 0) u = rand();
        while (v === 0) v = rand();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    // Random query vectors for each batch element (B * nFreqs)
    const B = 8;
    let x_bf = new Float64Array(B * nFreqs);
    let y_bf = new Float64Array(B * nFreqs);
    for (let idx = 0; idx < B * nFreqs; idx++) {
        x_bf[idx] = randn();
        y_bf[idx] = randn();
    }

    const freqs = new Float64Array(nFreqs * 2);
    for (let f = 0; f < nFreqs; f++) {
        let dx, dy, phi;
        phi = f * phiSpacing;
        dx = Math.cos(phi);
        dy = Math.sin(phi);
        const scale = minFreq * Math.pow(maxFreq / minFreq, nFreqs === 1 ? 0 : f / (nFreqs - 1));
        freqs[2 * f] = dx * scale;
        freqs[2 * f + 1] = dy * scale;
    }

    const align = new Float64Array(N * N);
    const twoNF = 2 * nFreqs;
    for (let i = 0; i < N; i++) {
        const posY = hh[i];
        for (let j = 0; j < N; j++) {
            const posX = ww[j];
            let sum = 0;

            for (let f = 0; f < nFreqs; f++) {
                const fx = freqs[2 * f];
                const fy = freqs[2 * f + 1];
                const theta = fx * posY + fy * posX;
                const c = Math.cos(theta);
                const s = Math.sin(theta);

                for (let b = 0; b < B; b++) {
                    const idx = b * nFreqs + f;
                    const x = x_bf[idx];
                    const y = y_bf[idx];
                    const xOut = x * c - y * s;
                    const yOut = x * s + y * c;
                    sum += xOut * x + yOut * y;
                }
            }
            align[i * N + j] = sum / (B * twoNF);
        }
    }
    return align;
}

const color = d3.scaleSequential(d3.interpolateViridis).domain([-1, 1]);

function drawHeatmap(data, N) {
    const canvas = document.getElementById("rope2d");
    canvas.width = N;
    canvas.height = N;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(N, N);

    for (let idx = 0; idx < data.length; idx++) {
        const v = data[idx];
        const rgb = d3.rgb(color(v));
        img.data[4 * idx] = rgb.r;
        img.data[4 * idx + 1] = rgb.g;
        img.data[4 * idx + 2] = rgb.b;
        img.data[4 * idx + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // const scale = 400 / N;
    // canvas.style.width = Math.floor(N * scale) + "px";
    // canvas.style.height = canvas.style.width;
}

let currentData = null;
let currentN = 51;
let lastPhiSpacing = null;

function readParams() {
    const axial = document.getElementById("axial_directions").checked;

    if (axial) {
        lastPhiSpacing = document.getElementById("phi_spacing").value;
        document.getElementById("phi_spacing").value = 1.5708;
        document.getElementById("phi_spacing_range").value = 1.5708;
    } else if (lastPhiSpacing !== null) {
        document.getElementById("phi_spacing").value = lastPhiSpacing;
        document.getElementById("phi_spacing_range").value = lastPhiSpacing;
        lastPhiSpacing = null;
    }

    return {
        N: parseInt(document.getElementById("N").value, 10),
        minFreq: parseFloat(document.getElementById("min_freq").value),
        maxFreq: parseFloat(document.getElementById("max_freq").value),
        nFreqs: parseInt(document.getElementById("n_freqs").value, 10),
        phiSpacing: parseFloat(document.getElementById("phi_spacing").value),
    };
}

function computeAndRender() {
    const p = readParams();

    currentN = p.N;
    currentData = computeAlignment(p.N, p.minFreq, p.maxFreq, p.nFreqs, p.phiSpacing);
    drawHeatmap(currentData, p.N);
}

function linkControls(name, isLog = false, vmin = null, vmax = null, invstep = null) {
    const range = document.getElementById(`${name}_range`);
    const number = document.getElementById(name);

    range.addEventListener("input", () => {
        if (name === "phi_spacing") document.getElementById("axial_directions").checked = false;
        if (isLog) {
            const logvmin = Math.log(vmin);
            const logvmax = Math.log(vmax);
            const t = range.value / range.max;
            const logv = logvmin + t * (logvmax - logvmin);
            number.value = Math.round(Math.exp(logv) * invstep) / invstep;
        } else number.value = range.value;
        computeAndRender();
    });

    function syncRangeToNumber() {
        if (name === "phi_spacing") document.getElementById("axial_directions").checked = false;
        const min = parseFloat(number.min);
        const max = parseFloat(number.max);
        if (number.value < min) number.value = min;
        if (number.value > max) number.value = max;
        if (isLog) {
            const logvmin = Math.log(vmin);
            const logvmax = Math.log(vmax);
            const logv = Math.log(number.value);
            const t = (logv - logvmin) / (logvmax - logvmin);
            range.value = t * range.max;
        } else range.value = number.value;
        computeAndRender();
    }
    number.addEventListener("change", syncRangeToNumber);

    syncRangeToNumber();
}

// ["N", "min_freq", "max_freq", "n_freqs", "phi_spacing"].forEach(linkControls);
linkControls("N");
linkControls("min_freq", true, 0.01, 50.0, 100);
linkControls("max_freq", true, 1.0, 1000, 10);
linkControls("n_freqs");
linkControls("phi_spacing");

document.getElementById("axial_directions").addEventListener("change", computeAndRender);

const canvas = document.getElementById("rope2d");
const tooltip = d3.select("#tooltip");
canvas.addEventListener("mousemove", (e) => {
    if (!currentData) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    if (x < 0 || x >= currentN || y < 0 || y >= currentN) {
        tooltip.style("display", "none");
        return;
    }

    const v = currentData[y * currentN + x];

    tooltip
        .style("left", `${e.pageX + 10}px`)
        .style("top", `${e.pageY + 10}px`)
        .style("display", "block")
        .text(`(${x}, ${y}) : ${v.toFixed(4)}`);
});

canvas.addEventListener("mouseleave", () =>
    tooltip.style("display", "none")
);

computeAndRender();