"use strict";
function autocrop(margin) {
    const w = this.bitmap.width;
    const h = this.bitmap.height;
    const data = this.bitmap.data;

    let t = findTopSide(data, w, h);
    if(t === h) return null;
    t = t - margin;
    let b = findBottomSide(data, w, h) + margin;
    let l = findLeftSide(data, w, t, b) - margin;
    let r = findRightSide(data, w, t, b) + margin;

    l = Math.min(w - 1, Math.max(0, l));
    r = Math.min(w - 1, Math.max(0, r));
    t = Math.min(h - 1, Math.max(0, t));
    b = Math.min(h - 1, Math.max(0, b));

    this.crop(l, t, w - (w - r + l), h - (h - b + t));
    return this;
};

function getCropSize(obj, margin){
    const w = obj.bitmap.width;
    const h = obj.bitmap.height;
    const data = obj.bitmap.data;

    let t = findTopSide(data, w, h);
    if(t === h) return null;
    t = t - margin;
    let b = findBottomSide(data, w, h) + margin;
    let l = findLeftSide(data, w, t, b) - margin;
    let r = findRightSide(data, w, t, b) + margin;

    l = Math.min(w - 1, Math.max(0, l));
    r = Math.min(w - 1, Math.max(0, r));
    t = Math.min(h - 1, Math.max(0, t));
    b = Math.min(h - 1, Math.max(0, b));
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