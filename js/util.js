const newLineReg = /\r\n|\n|\r/g;
const asciiReg = /[a-zA-Z0-9!-/:-@¥[-`{-~ ]/g;
const fs = require('fs');
const ApplySettingEvent = new CustomEvent('apply_setting');
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
let ExtensionSettings = {};
let ExtensionSettingsFilePath = null;
let SetectedProjectItemTreePath = '';

function GetUUID() {
    let uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".split("");
    let length = uuid.length;
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
function getText(path, encode = 'AUTO') {
    if(fs.existsSync(path)) {
        const data = fs.readFileSync(path);
        return Encoding.convert(data, {from: encode, to: 'UNICODE', type: 'string'});
    }
    return null;
}

function SaveJson(obj, path) {
    return window.cep.fs.writeFile(path, JSON.stringify(obj)).err;
}

$(document).on('change', '.input_num_only', function() {
    let target = $(this);
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

function enableSwitch(jq_elm) {
    const enable = jq_elm.hasClass('enable');
    if(enable){
        jq_elm.addClass('disable');
        jq_elm.removeClass('enable');
    } else {
        jq_elm.addClass('enable');
        jq_elm.removeClass('disable');
    }
}

$(document).on('click', '.get_select_project_clip', function() {
    const target = $(this);
    const treePath = SetectedProjectItemTreePath;
    console.log(treePath);
    const csInterface = new CSInterface();
    csInterface.evalScript('$._PPP_.existClipTreePath("' + treePath + '")', function(result) {
        if(result) {
            target.html(treePath);
            target.attr('uk-tooltip', treePath);
            target.addClass('tdact_setting_ok');
            target.removeClass('tdact_setting_error');
            const category = target.attr('category');
            const id = target.attr('id');
            SettingUpdate(category, id, treePath);
        }
    });
});