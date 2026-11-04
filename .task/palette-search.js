import { tokens } from '../packages/tokens/src/tokens.ts';
// Reproduce the existing web palette method without editing the web test.
const CVD = {
    protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
    deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
    tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};
const linear = (channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
function labOf(hex, vision) {
    const [r, g, b] = [1, 3, 5].map((at) => linear(Number.parseInt(hex.slice(at, at + 2), 16) / 255));
    let rr = r;
    let gg = g;
    let bb = b;
    if (vision !== 'normal') {
        const [m0, m1, m2, m3, m4, m5, m6, m7, m8] = CVD[vision];
        rr = Math.min(1, Math.max(0, m0 * r + m1 * g + m2 * b));
        gg = Math.min(1, Math.max(0, m3 * r + m4 * g + m5 * b));
        bb = Math.min(1, Math.max(0, m6 * r + m7 * g + m8 * b));
    }
    const X = (0.4124564 * rr + 0.3575761 * gg + 0.1804375 * bb) / 0.95047;
    const Y = 0.2126729 * rr + 0.7151522 * gg + 0.072175 * bb;
    const Z = (0.0193339 * rr + 0.119192 * gg + 0.9503041 * bb) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const [fx, fy, fz] = [f(X), f(Y), f(Z)];
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
/** WCAG 2.x relative luminance of an sRGB `#rrggbb` colour. */
function luminance(hex) {
    const channel = (at) => {
        const value = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}
/** WCAG 2.x contrast ratio of two sRGB `#rrggbb` colours. */
function contrastRatio(first, second) {
    const [lighter, darker] = luminance(first) >= luminance(second) ? [first, second] : [second, first];
    return (luminance(lighter) + 0.05) / (luminance(darker) + 0.05);
}
const visions = ['normal', 'protanopia', 'deuteranopia', 'tritanopia'];
const referenceNames = [
    'color-chain-1', 'color-chain-2', 'color-chain-3', 'color-chain-4', 'color-chain-5', 'color-chain-6',
    'color-issuer-mint', 'color-issuer-burn', 'color-bridge-in', 'color-bridge-out', 'color-net',
    'color-positive', 'color-negative', 'color-delayed', 'color-unreconciled', 'color-unpaired', 'color-incomplete',
];
const references = visions.map((vision) => referenceNames.map((name) => labOf(tokens[name], vision)));
const floor = process.argv.includes('--rounded') ? 19.95 : 20;
const cells = new Map();
let eligible = 0;
// Exhaust all 24-bit colours. Keep only colours satisfying every fixed-reference
// constraint. Cell intervals enclose the Lab coordinates of every survivor.
for (let rgb = 0; rgb < 0x1000000; rgb++) {
    const hex = `#${rgb.toString(16).padStart(6, '0')}`;
    if (contrastRatio(hex, tokens['color-bg']) < 4.5 || contrastRatio(hex, tokens['color-surface']) < 4.5)
        continue;
    const labs = [];
    let passes = true;
    for (const [index, vision] of visions.entries()) {
        const lab = labOf(hex, vision);
        labs.push(lab);
        if (references[index].some((other) => Math.hypot(...lab.map((value, axis) => value - other[axis])) < floor)) {
            passes = false;
            break;
        }
    }
    if (!passes)
        continue;
    eligible++;
    // 16-channel-wide RGB cells. Lab extrema are measured over every eligible
    // colour in the cell, rather than approximated from its RGB corners.
    const key = ((rgb >> 20) << 8) | (((rgb >> 12) & 15) << 4) | ((rgb >> 4) & 15);
    const bounds = cells.get(key);
    if (bounds) {
        for (const [vision, lab] of labs.entries()) {
            for (const [axis, value] of lab.entries()) {
                bounds[vision][axis][0] = Math.min(bounds[vision][axis][0], value);
                bounds[vision][axis][1] = Math.max(bounds[vision][axis][1], value);
            }
        }
    }
    else {
        cells.set(key, labs.map((lab) => lab.map((value) => [value, value])));
    }
}
const bounds = [...cells.values()];
const withinCellUpperBound = Math.max(...bounds.map((cell) => Math.min(...cell.map((vision) => Math.hypot(...vision.map(([low, high]) => high - low))))));
if (withinCellUpperBound >= floor)
    throw new Error('Cannot exclude two colours in one cell');
// An edge admits a possible separated pair. The interval upper bound can admit
// false edges but cannot exclude an actual passing pair. Consequently, a
// four-colour palette requires a four-clique of distinct cells in this graph.
const adjacency = bounds.map(() => new Set());
for (let first = 0; first < bounds.length; first++) {
    for (let second = first + 1; second < bounds.length; second++) {
        const possible = visions.every((_, vision) => Math.hypot(...[0, 1, 2].map((axis) => Math.max(Math.abs(bounds[first][vision][axis][0] - bounds[second][vision][axis][1]), Math.abs(bounds[first][vision][axis][1] - bounds[second][vision][axis][0])))) >= floor);
        if (possible)
            adjacency[first].add(second);
    }
}
let fourClique;
outer: for (let first = 0; first < bounds.length; first++) {
    for (const second of adjacency[first]) {
        const common = [...adjacency[second]].filter((third) => adjacency[first].has(third));
        for (const third of common) {
            const fourth = common.find((candidate) => adjacency[third].has(candidate));
            if (fourth !== undefined) {
                fourClique = [first, second, third, fourth];
                break outer;
            }
        }
    }
}
console.log(JSON.stringify({
    floor,
    eligible,
    cells: bounds.length,
    edges: adjacency.reduce((sum, neighbours) => sum + neighbours.size, 0),
    withinCellUpperBound,
    fourClique: fourClique ?? null,
}, null, 2));
if (fourClique)
    throw new Error('Bound is inconclusive, refine the cells');
