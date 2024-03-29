"use strict";
function autocrop(margin) {
    const rect = getCropSize(this, margin);
    if(rect === null) return null;
    const l = rect[0];
    const t = rect[1];
    const r = rect[2];
    const b = rect[3];
    const w = r - l + 1;
    const h = b - t + 1;

    this.crop(l, t, w, h);
    return [l, t, w, h];
};

function getCropSize(obj, margin){
    const w = obj.bitmap.width;
    const h = obj.bitmap.height;
    const data = obj.bitmap.data;

    let t = findTopSide(data, w, h);
    if(t === h) return null;
    let b = findBottomSide(data, w, h);
    let l = findLeftSide(data, w, t, b);
    let r = findRightSide(data, w, t, b);

    l = Math.min(w - 1, Math.max(0, l - margin));
    r = Math.min(w - 1, Math.max(0, r + margin));
    t = Math.min(h - 1, Math.max(0, t - margin));
    b = Math.min(h - 1, Math.max(0, b + margin));

    return [l, t, r, b];
}

function findLeftSide(data, w, t, b) {
    for (let x = 0; x < w; x++) {
        for (let y = t; y <= b; y++) {
            if (data[(y * w + x) * 4 + 3] !== 0) {
                return x;
            }
        }
    }
    return w;
}

function findRightSide(data, w, t, b) {
    for (let x = w - 1; x > 0; x--) {
        for (let y = t; y <= b; y++) {
            if (data[(y * w + x) * 4 + 3] !== 0) {
                return x;
            }
        }
    }
    return -1;
}

function findTopSide(data, w, h) {
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (data[(y * w + x) * 4 + 3] !== 0) {
                return y;
            }
        }
    }
    return h;
}

function findBottomSide(data, w, h) {
    for (let y = h - 1; y > 0; y--) {
        for (let x = 0; x < w; x++) {
            if (data[(y * w + x) * 4 + 3] !== 0) {
                return y;
            }
        }
    }
    return -1;
}