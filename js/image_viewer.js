const AP_canvas = document.getElementById('animation_preview_canvas');
const AP_ctx = AP_canvas.getContext('2d');
const AP_image = new Image();
let AP_image_cache = [];
const AP_MAX_SCALE = 10;
let ap_imageScale = 1;
let ap_mouseMoveX = 0, ap_mouseMoveY = 0;
let ap_press = false;
let ap_interest_rect = [0, 0, 0, 0];
let ap_img_width = 0;
let ap_img_height = 0;

let ap_zoomLeft = 0, ap_zoomTop = 0, ap_zoomLeftBuf = 0, ap_zoomTopBuf = 0;
let ap_source_list = [];

function AnimationPreviewDisableScroll() {document.addEventListener("mousewheel", AnimationPreviewScrollControl, { passive: false });}
function AnimationPreviewEnableScroll() {document.removeEventListener("mousewheel", AnimationPreviewScrollControl, { passive: false });}
function AnimationPreviewScrollControl(e) {e.preventDefault();}
AP_canvas.addEventListener('mousewheel', AnimationPreviewCanvasZoom);
AP_canvas.addEventListener('mouseover', AnimationPreviewDisableScroll);
AP_canvas.addEventListener('mouseout', AnimationPreviewEnableScroll);
AP_canvas.addEventListener('mousedown', function(e){
    ap_zoomLeftBuf = ap_zoomLeft;
    ap_zoomTopBuf = ap_zoomTop;
    ap_mouseMoveX = e.clientX;
    ap_mouseMoveY = e.clientY;
    ap_press = true;
});
document.addEventListener('mouseup', function(){ap_press = false;});
document.addEventListener('mousemove', mouseMove);

function AnimationPreviewReset(){
    const width = ap_interest_rect[2] - ap_interest_rect[0];
    const height = ap_interest_rect[3] - ap_interest_rect[1];
    if(width > height){
        ap_imageScale = (AP_canvas.width / width);
        ap_zoomLeft = ap_interest_rect[0];
        ap_zoomTop = ap_interest_rect[1] - (width - height) / 2;
    } else {
        ap_imageScale = (AP_canvas.height / height);
        ap_zoomLeft = ap_interest_rect[0] - (height - width) / 2;
        ap_zoomTop = ap_interest_rect[1];
    }
    AP_Refresh();
}

function SetAnimationPreviewSource(source_list, rect, view_reset = true){
    ap_source_list = source_list;
    ap_interest_rect = rect;
    AP_image_cache = [];
    for (let i = 1; i < ap_source_list.length; i++) {
        const img = new Image();
        img.src = ap_source_list[i];
        AP_image_cache.push(img);
    }
    AP_image.src = ap_source_list[0];
    AP_image.onload = function () {
        AP_image.onload = null;
        ap_img_width = AP_image.naturalWidth;
        ap_img_height = AP_image.naturalHeight;
        if(view_reset){
            AnimationPreviewReset();
        }else{
            AP_Refresh();
        }
    }
}

function AP_Refresh() {
    AP_ctx.clearRect(0, 0, AP_canvas.width, AP_canvas.height);
    AP_ctx.drawImage(AP_image, ap_zoomLeft, ap_zoomTop, AP_canvas.width / ap_imageScale, AP_canvas.height / ap_imageScale, 0, 0, AP_canvas.width, AP_canvas.height);
}

function AnimationPreviewDraw(index){
    AP_image.src = ap_source_list[index];
    AP_Refresh();
}

function AnimationPreviewCanvasZoom(e) {
    let rect = e.target.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    let oldScale = ap_imageScale;
    if (e.wheelDelta > 0) {
        if (ap_imageScale < AP_MAX_SCALE) {
            ap_imageScale = ap_imageScale * 1.2;
            const coef = (ap_imageScale - oldScale) / (ap_imageScale * oldScale);
            ap_zoomLeft += mouseX * coef;
            ap_zoomTop += mouseY * coef;
        }
    } else {
        if (ap_imageScale > 0.2) {
            ap_imageScale = ap_imageScale / 1.2;
            const coef = (ap_imageScale - oldScale) / (ap_imageScale * oldScale);
            ap_zoomLeft += mouseX * coef;
            ap_zoomTop += mouseY * coef;
        }
    }
    
    AP_Refresh();
}

function mouseMove(e) {
    if (ap_press) {
        ap_zoomLeft = ap_zoomLeftBuf + (ap_mouseMoveX - e.clientX) / ap_imageScale;
        ap_zoomTop = ap_zoomTopBuf + (ap_mouseMoveY - e.clientY) / ap_imageScale;
        AP_Refresh();
    }
}

