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

const N = 51;
const minFreq = 2.0;
const maxFreq = 64.0;
const nFreqs = 256;
const phiSpacing = Math.PI * (Math.sqrt(5) - 1);

function computeAlignment(nComponents) {
    const hh = linspace(-1.2, 1.2, N);
    const ww = linspace(-1.2, 1.2, N);

    let rand = sfc32(seed[0], seed[1], seed[2], seed[3]);

    function randn() {
        let u = 0, v = 0;
        while (u === 0) u = rand();
        while (v === 0) v = rand();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    // Random query vectors for each batch element (B * nFreqs)
    const B = 4;
    let x_bf = new Float64Array(B * nFreqs);
    let y_bf = new Float64Array(B * nFreqs);
    for (let idx = 0; idx < B * nFreqs; idx++) {
        x_bf[idx] = randn();
        y_bf[idx] = randn();
    }

    const freqs = new Float64Array(nFreqs * 2);
    for (let f = 0; f < nComponents; f++) {
        let dx, dy, phi;
        phi = f * phiSpacing;
        dx = Math.cos(phi);
        dy = Math.sin(phi);
        const scale = minFreq * Math.pow(maxFreq / minFreq, nFreqs === 1 ? 0 : f / (nFreqs - 1));
        freqs[2 * f] = dx * scale;
        freqs[2 * f + 1] = dy * scale;
    }

    const align = new Float64Array(N * N);
    for (let i = 0; i < N; i++) {
        const posY = hh[i];
        for (let j = 0; j < N; j++) {
            const posX = ww[j];
            let sum = 0;

            for (let f = 0; f < nComponents; f++) {
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
            align[i * N + j] = sum / (B * 2 * nComponents);
        }
    }
    return align;
}

const color = d3.scaleSequential(d3.interpolateViridis).domain([-1, 1]);

function drawHeatmap(data, N) {
    const canvas = document.getElementById("rope2d_components");
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
}

let currentData = null;

function computeAndRender() {
    const nComponents = parseInt(document.getElementById("n_components").value, 10);

    currentData = computeAlignment(nComponents);
    drawHeatmap(currentData, N);
}

function linkControls(name) {
    const range = document.getElementById(`${name}_range`);
    const number = document.getElementById(name);
    function sync(from, to) {
        to.value = from.value;
        computeAndRender();
    }
    range.addEventListener("input", () => { sync(range, number) });
    number.addEventListener("change", () => {
        const min = parseFloat(number.min);
        const max = parseFloat(number.max);
        if (number.value < min) number.value = min;
        if (number.value > max) number.value = max;
        sync(number, range);
    });
}

linkControls("n_components")

// const canvas = document.getElementById("rope2d_components");
// const tooltip = d3.select("#tooltip");
// canvas.addEventListener("mousemove", (e) => {
//     if (!currentData) return;

//     const rect = canvas.getBoundingClientRect();
//     const scaleX = canvas.width / rect.width;
//     const scaleY = canvas.height / rect.height;

//     const x = Math.floor((e.clientX - rect.left) * scaleX);
//     const y = Math.floor((e.clientY - rect.top) * scaleY);

//     if (x < 0 || x >= 41 || y < 0 || y >= 41) {
//         tooltip.style("display", "none");
//         return;
//     }

//     const v = currentData[y * currentN + x];

//     tooltip
//         .style("left", `${e.pageX + 10}px`)
//         .style("top", `${e.pageY + 10}px`)
//         .style("display", "block")
//         .text(`(${x}, ${y}) : ${v.toFixed(4)}`);
// });

// canvas.addEventListener("mouseleave", () =>
//     tooltip.style("display", "none")
// );

computeAndRender();