const csInterface = new CSInterface();
const newLineReg = /\r\n|\n|\r/g;
const asciiReg = /[a-zA-Z0-9!-/:-@¥[-`{-~ ]/g;
const fs = require('fs');
const path_js = require('path');
const dragula = require('dragula');
const ApplySettingEvent = new CustomEvent('apply_setting');
const OSIsWin = csInterface.getOSInformation().indexOf('Win') >= 0 ? true : false;
const apiVersion = csInterface.getCurrentApiVersion();
const hostEnvironment = csInterface.getHostEnvironment();
let CustomInitialize = {};
let CEP_ERROR_TO_MESSAGE = {};
CEP_ERROR_TO_MESSAGE[window.cep.fs.NO_ERROR] = "No error";
CEP_ERROR_TO_MESSAGE[window.cep.fs.ERR_UNKNOWN] = "[error] Unknown error occurred.";
CEP_ERROR_TO_MESSAGE[window.cep.fs.ERR_INVALID_PARAMS] = "[error] Invalid parameters passed to function.";
CEP_ERROR_TO_MESSAGE[window.cep.fs.ERR_NOT_FOUND] = "[error] File or directory was not found.";
CEP_ERROR_TO_MESSAGE[window.cep.fs.ERR_CANT_READ] = "[error] File or directory could not be read.";
CEP_ERROR_TO_MESSAGE[window.cep.fs.ERR_UNSUPPORTED_ENCODING] = "[error] An unsupported encoding value was specified.";
CEP_ERROR_TO_MESSAGE[window.cep.fs.ERR_CANT_WRITE] = "[error] File could not be written.";
CEP_ERROR_TO_MESSAGE[window.cep.fs.ERR_OUT_OF_SPACE] = "[error] Target directory is out of space. File could not be written.";
CEP_ERROR_TO_MESSAGE[window.cep.fs.ERR_NOT_FILE] = "[error] Specified path does not point to a file.";
CEP_ERROR_TO_MESSAGE[window.cep.fs.ERR_NOT_DIRECTORY] = "[error] Specified path does not point to a directory.";
CEP_ERROR_TO_MESSAGE[window.cep.fs.ERR_FILE_EXISTS] = "[error] Specified file already exists.";
CEP_ERROR_TO_MESSAGE[window.cep.fs.ERR_EXCEED_MAX_NUM_PROCESS] = "[error]  The maximum number of processes has been exceeded.";
CEP_ERROR_TO_MESSAGE[window.cep.fs.ERR_INVALID_URL] = "[error] Invalid URL.";
CEP_ERROR_TO_MESSAGE[window.cep.fs.DEPRECATED_API] = "[error] deprecated API.";

let audioTrackSelectBox = [];
let videoTrackSelectBox = [];
let SetectedProjectItemTreePath = '';

function GetUUID() {
    let uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".split("");
    const length = uuid.length;
    for (let i = 0; i < length; i++) {
        switch (uuid[i]) {
            case "x":
                uuid[i] = Math.floor(Math.random() * 16).toString(16);
                break;
            case "y":
                uuid[i] = (Math.floor(Math.random() * 4) + 8).toString(16);
                break;
        }
    }
    return uuid.join("");
}

const Encoding = require('encoding-japanese');
function getFileText(path, encode = 'AUTO') {
    if(fs.existsSync(path)) {
        const data = fs.readFileSync(path);
        return Encoding.convert(data, {from: encode, to: 'UNICODE', type: 'string'});
    }
    return null;
}

function SaveJson(obj, path) {
    return window.cep.fs.writeFile(path, JSON.stringify(obj)).err;
}

$(document).on('change', '.input_integer_only', function() {
    const target = $(this);
    let inputval = target.val().match(/[0-9０-９]+/g);
    if(inputval) {
        inputval = inputval.join('').replace(/[０-９]/g, function(s) {
            return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
        });
        target.val(inputval);
    } else {
        target.val('');
    }
});

$(document).on('change', '.input_positive_num_only', function() {
    const target = $(this);
    let inputval = target.val().match(/[0-9０-９\.]+/g);
    if(inputval) {
        inputval = inputval.join('').replace(/[０-９]/g, function(s) {
            return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
        });
        inputval = inputval.match(/\d+(?:\.\d+)?/).join('');
        target.val(inputval);
    } else {
        target.val('');
    }
});
$(document).on('change', '.input_num_only', function() {
    const target = $(this);
    let inputval = target.val().match(/[0-9０-９\.\-]+/g);
    if(inputval) {
        inputval = inputval.join('').replace(/[０-９]/g, function(s) {
            return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
        });
        inputval = inputval.match(/-?\d+(?:\.\d+)?/).join('');
        target.val(inputval);
    } else {
        target.val('');
    }
});

$(document).on('click', '.merker_color_selector', function() {
    const target = $(this);
    target.siblings('.merker_color_selector').each(function(index, element){
        $(element).removeClass('merker_color_selected');
        $(element).empty();
    });
    if(!target.hasClass('merker_color_selected')) {
        target.addClass('merker_color_selected');
        target.append($('<div>', {'uk-icon':'icon: check; ratio:1.5', style:'color:#232323'}))
    }
    const parent = target.parent();
    const category = parent.attr('category');
    const id = parent.attr('id');
    const value = parent.children().index(target);
    SettingUpdate(category, id, value);
});

$(document).on('click', '.get_select_project_clip', function() {
    const target = $(this);
    const treePath = SetectedProjectItemTreePath;
    csInterface.evalScript(makeEvalScript('ExistClipTreePath', treePath), function(result) {
        if(result) {
            target.html(treePath);
            target.attr('uk-tooltip', treePath);
            setSettingOK(target);
            const category = target.attr('category');
            const id = target.attr('id');
            SettingUpdate(category, id, treePath);
        }
    });
});

$(document).on('click', '.get_select_project_mediapath', function() {
    const target = $(this);
    const treePath = SetectedProjectItemTreePath;
    const script = makeEvalScript('GetMediaPath_File', treePath);
    csInterface.evalScript(script, function(result) {
        if(result) {
            target.html(result);
            target.attr('uk-tooltip', result);
            setSettingOK(target);
            const category = target.attr('category');
            const id = target.attr('id');
            SettingUpdate(category, id, result);
        }
    });
});

$(document).on('click', '.get_select_project_bin', function() {
    const target = $(this);
    const treePath = SetectedProjectItemTreePath;
    csInterface.evalScript(makeEvalScript('ExistBinTreePath', treePath), function(result) {
        if(result) {
            target.html(treePath);
            target.attr('uk-tooltip', treePath);
            setSettingOK(target);
            const category = target.attr('category');
            const id = target.attr('id');
            SettingUpdate(category, id, treePath);
        }
    });
});

function getClipEndFlag(root_jq_elm) {
    let clipEndFlag = 0;
    if(root_jq_elm.find('.insert_inpoint').hasClass('enable')) clipEndFlag += 1;
    if(root_jq_elm.find('.insert_outpoint').hasClass('enable')) clipEndFlag += 2;
    if(root_jq_elm.find('.insert_marker').hasClass('enable')) clipEndFlag += 4;
    return clipEndFlag;
}
function enableSwitch(jq_elm) {
    const enable = jq_elm.hasClass('enable');
    if(enable){
        setDisable(jq_elm);
        return false;
    } else {
        setEnable(jq_elm);
        return true;
    }
}
function setEnable(jq_elm) {
    jq_elm.removeClass('disable');
    jq_elm.addClass('enable');
}
function setDisable(jq_elm) {
    jq_elm.removeClass('enable');
    jq_elm.addClass('disable');
}
function setSettingFlag(jq_elm, ok = true) {
    if(ok) {
        setSettingOK(jq_elm);
    } else {
        setSettingError(jq_elm);
    }
}
function setSettingOK(jq_elm) {
    jq_elm.removeClass('tdact_setting_error');
    jq_elm.addClass('tdact_setting_ok');
}
function setSettingError(jq_elm) {
    jq_elm.removeClass('tdact_setting_ok');
    jq_elm.addClass('tdact_setting_error');
}
function resetSettingFlag(jq_elm) {
    jq_elm.removeClass('tdact_setting_ok');
    jq_elm.removeClass('tdact_setting_error');
}

const catch_process = 'catch(e){\
    var msg = ["2dActorToolsでエラーが発生しました。\\n問題解決のために、この表示を開発者にお知らせください。\\nその際、個人情報や知られたくない内容が含まれないようご注意ください。\\n"];\
    msg.push("appVer: " + "' + hostEnvironment.appVersion + '");\
    msg.push("extVer: " + "' + getExtensionVersion() + '");\
    msg.push("apiVer: " + "' + [apiVersion.major, apiVersion.minor, apiVersion.micro].join('.') + '");\
    msg.push("appLoc: " + "' + hostEnvironment.appLocale + '");\
    msg.push("UILoc: " + "' + hostEnvironment.appUILocale + '");\
    msg.push("number: " + e.number.toString());\
    msg.push("fileName: " + e.fileName.toString());\
    msg.push("line: " + e.line.toString());\
    msg.push("start: " + e.start.toString());\
    msg.push("end: " + e.end.toString());\
    msg.push("message: " + e.message.toString());\
    msg.push("name: " + e.name.toString());\
    msg.push("description: " + e.description.toString());';
function makeEvalScript(functionName, ...params){
    return 'try{$._PPP_.' + functionName + '("' + params.join('","') + '")}' + catch_process + 
    'msg.push("functionName: ' + functionName.toString() + '");\
    msg.push("params: ' + params.join('","') + '");\
    alert(msg.join("\\n"));}';
};
function makeEvalScriptNoConvertParams(functionName, param){
    return 'try{$._PPP_.' + functionName + '(' + param + ')}' + catch_process + 
    'msg.push("functionName: ' + functionName.toString() + '");\
    msg.push("params: ' + param.replace(/\"/g, "'") + '");\
    alert(msg.join("\\n"));}';
};

const sleep = async (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getExtensionVersion(){
    const xmlStr = window.cep.fs.readFile(csInterface.getSystemPath(SystemPath.EXTENSION) + '/CSXS/manifest.xml').data;
    const pattern = 'ExtensionBundleVersion="'
    const start = xmlStr.indexOf('ExtensionBundleVersion="') + pattern.length;
    const end = xmlStr.indexOf('"', start);
    return xmlStr.substring(start, end);
}

function swapUikitConfirmButton(parent) {
    const button = parent.find('.uk-modal-footer').children();
    button.next().after(button);
    button.css('margin-right','10px');
}
function setWarningToUikitConfirmButton(parent, index){
    const button = parent.find('.uk-modal-footer').children();
    button.eq(index).addClass('tdact_setting_error');
}

function BusyNotificationOpen(text, progress_max=null){
    const BusyNotificationProgress = $('#busy_progress');
    BusyNotificationProgress.val(0);
    if(progress_max !== null){
        BusyNotificationProgress.attr('max', progress_max);
    }
    $('#mainfunc').addClass('disable');
    const text_elm = $('#busy_text');
    text_elm.html(text);
    UIkit.modal($('#busy_notification')).show();
}
function BusyNotificationClose(){
    setTimeout(_BusyNotificationClose, 500);
}
function _BusyNotificationClose(){
    $('#mainfunc').removeClass('disable');
    UIkit.modal($('#busy_notification')).hide();
}
function ErrorNotificationOpen(text, help_content=null){
    const text_elm = $('#error_text');
    text_elm.html(text);
    const help_elm = $('#error_notification_help');
    const label = $('#error_help_label');
    help_elm.empty();
    if(help_content !== null){
        label.removeAttr('hidden');
        help_elm.append(help_content);
    } else {
        label.attr('hidden', '');
    }
    UIkit.modal($('#error_notification')).show();
}
function ErrorNotificationClose(){
    UIkit.modal($('#error_notification')).hide();
}
