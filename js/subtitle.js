$('#subtitle_replace_flag').on('change', function() {
    const val = $(this).val().match(/[gimuys]+/);
    if(val) {
        $(this).val(val.join(''));
    } else {
        $(this).val('');
    }
});
$(document).on('click', '#mogrt_history_trash', function() {
    const select_mogrt = $('#select_mogrt');
    const option = $(select_mogrt).find('option:selected');
    if(!option.attr('imported')){
        RemoveMogrtPath(select_mogrt.val());
        option.remove();
        select_mogrt.change();
    }
});
$(document).on('change', '#select_mogrt', function() {
    const select_mogrt = document.getElementById('mogrt_history_trash');
    const option = $('#select_mogrt').find('option:selected');
    const mogrt_trash = $('#mogrt_history_trash');
    if(option.attr('imported')){
        mogrt_trash.attr('hidden', '');
    } else {
        mogrt_trash.removeAttr('hidden');
    }
});

function mogrtUpdate() {
    const select_mogrt = document.getElementById('select_mogrt');
    csInterface.evalScript(makeEvalScript('GetMGTClipName'), function(names) {
        const mogrtHistory = GetMogrtHistory();
        if(names.length > 0){
            names = names.split(',');
        } else {
            names = [];
        }
        for(let i = 0; i < names.length; i++){
            while(true){
                const index = mogrtHistory.indexOf(names[i]);
                if(index > -1){
                    delete mogrtHistory[index];
                }else{
                    break;
                }
            }
        }
        const nameList = names.concat(mogrtHistory).filter(Boolean);

        for(let i = 0; i < nameList.length; i++){
            if(i < select_mogrt.childNodes.length){
                select_mogrt.childNodes[i].innerHTML = nameList[i];
                select_mogrt.childNodes[i].value = nameList[i];
                select_mogrt.childNodes[i].setAttribute('imported', i < names.length ? '1' : '');
            } else {
                let option = document.createElement('option');
                option.setAttribute('value', nameList[i]);
                option.innerHTML = nameList[i];
                option.setAttribute('imported', i < names.length ? '1' : '');
                select_mogrt.appendChild(option);
            }
        }
        while(nameList.length < select_mogrt.childNodes.length) {
            select_mogrt.removeChild(select_mogrt.lastChild);
        }
        $(select_mogrt).change();
    });
}

function importMGT() {
    const mogrtPathList = window.cep.fs.showOpenDialogEx(true, false, 'モーショングラフィックステンプレート', '', ['mogrt']).data;
    if(mogrtPathList != '') {
        for(let i = 0; i < mogrtPathList.length; i++){
            let name = path_js.basename(mogrtPathList[i]);
            name = name.substr(0, name.lastIndexOf('.')) || name;
            SetMogrtPath(name, mogrtPathList[i]);
        }
        csInterface.evalScript(makeEvalScript('ImportMOGRTFile', mogrtPathList.join('\\n')), mogrtUpdate);
    }
}

function insertSubtitleFromTextarea() {
    const mogrt = document.getElementById("select_mogrt");
    const text = document.getElementById("subtitles");
    let replaceReg = null;
    if(('#subtitle_replace').val() != '') {
        try {
            replaceReg = new RegExp($('#subtitle_replace').val(), $('#subtitle_replace_flag').val());
        } catch (e) {
            alert(e);
        }
    }
    var newLines = text.value.match(newLineReg);
    if (newLines == null){
        count = 1;
    }else{
        count = newLines.length;
    }

    const replaceAfter = $('#subtitle_replace_after').val();
    const script = makeEvalScript('InsertSubtitle', mogrt.value, 
        text.value.replace(/\//g, '').replace(newLineReg, '/').replace(/\"/g, '\\"').replace(replaceReg, replaceAfter));

    BusyNotificationOpen('字幕を並べています', count);
    if(isMogrtImported(mogrt.value)){
        csInterface.evalScript(script, function(){BusyNotificationClose();});
    } else {
        const importPath = GetMogrtPath(mogrt.value);
        csInterface.evalScript(makeEvalScript('ImportMOGRTFile', importPath), function(){
            mogrtUpdate();
            csInterface.evalScript(script, function(){BusyNotificationClose();});
        });
    }
}

function insertSubtitleFromTextFile() {
    csInterface.evalScript(makeEvalScript('GetTragetAudioClipMediaPath'), function(result){
        let replaceReg = null;
        if($('#subtitle_replace').val() != '') {
            try {
                replaceReg = new RegExp($('#subtitle_replace').val(), $('#subtitle_replace_flag').val());
            } catch (e) {
                alert(e);
            }
        }
        const replaceAfter = $('#subtitle_replace_after').val();
        let mediaPathList = result.split(',');
        let textList = [];
        const OSVersion = csInterface.getOSInformation();
        let dirSeparater = '/';
        if(OSVersion.includes('Windows')) {
            dirSeparater = '\\';
        }
        const presetTag = $('#preset_tag').val();
        for(let i = 0; i < mediaPathList.length; i++) {
            const path = mediaPathList[i].slice(0, mediaPathList[i].lastIndexOf('.') + 1) + 'txt';
            let text = getFileText(path);
            if(text != null) {
                if(presetTag !== '') {
                    textList.push(text.slice(text.indexOf(presetTag) + 1).replace(newLineReg, '\\n').replace(/\//g, '').replace(/\"/g, '\\"').replace(replaceReg, replaceAfter));
                } else {
                    textList.push(text.replace(newLineReg, '\\n').replace(/\//g, '').replace(/\"/g, '\\"').replace(replaceReg, replaceAfter));
                }
            } else {
                const lastDirSepIndex = mediaPathList[i].lastIndexOf(dirSeparater) + 1;
                textList.push(mediaPathList[i].slice(lastDirSepIndex, mediaPathList[i].lastIndexOf('.')).replace(/\//g, ''));
            }
        }
        const mogrt = document.getElementById("select_mogrt");
        const script = makeEvalScript('InsertSubtitle', mogrt.value, textList.join('/'));

        BusyNotificationOpen('字幕を並べています', mediaPathList.length - 1);
        if(isMogrtImported(mogrt.value)){
            csInterface.evalScript(script, function(){BusyNotificationClose();});
        } else {
            const importPath = GetMogrtPath(mogrt.value);
            csInterface.evalScript(makeEvalScript('ImportMOGRTFile', importPath), function(){
                mogrtUpdate();
                csInterface.evalScript(script, function(){BusyNotificationClose();});
            });
        }
    });	
}

function insertSubtitleFromPSD() {
    if($('#psd_import_bin').hasClass('tdact_setting_ok')){
        const importBinTree = $('#psd_import_bin').html();
        const script = makeEvalScript('InsertSubtitle_PSD', importBinTree);
        BusyNotificationOpen('字幕を並べています');
        csInterface.evalScript(script);
    } else {
        setSettingError($('#psd_import_bin'));
    }
}

function isMogrtImported(value){
    return $(`#select_mogrt [value=${value}]`).attr('imported');
}

CustomInitialize['insert_subtitle_initialize'] = function () {
    const category = GetUIParams('insert_subtitle');
    if(category) {
        const psd_import_bin = category['psd_import_bin'];
        if(psd_import_bin) {
            const target = $('#psd_import_bin');
            target.html(psd_import_bin);
            const script = makeEvalScript('ExistBinTreePath', psd_import_bin);
            csInterface.evalScript(script, function(result){
                if(result) {
                    setSettingOK(target);
                } else {
                    setSettingError(target);
                }
            });
        }
    }
}