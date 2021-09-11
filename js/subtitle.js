$('#subtitle_replace_flag').on('change', function() {
    const val = $(this).val().match(/[gimuys]+/);
    if(val) {
        $(this).val(val.join(''));
    } else {
        $(this).val('');
    }
});

function mogrtUpdate() {
    let select_mogrt = document.getElementById('select_mogrt');
    csInterface.evalScript('$._PPP_.GetMGTClipName()', function(names) {
        var nameList = names.split(',');
        for(let i = 0; i < nameList.length; i++){
            if(i < select_mogrt.childNodes.length){
                select_mogrt.childNodes[i].innerHTML = nameList[i];
                select_mogrt.childNodes[i].value =  nameList[i];
            } else {
                let option = document.createElement('option');
                option.setAttribute('value', nameList[i]);
                option.innerHTML = nameList[i];
                select_mogrt.appendChild(option);
            }
        }
        while(nameList.length < select_mogrt.childNodes.length) {
            select_mogrt.removeChild(select_mogrt.lastChild);
        }
    });
}

function importMGT() {
    const mogrtPathList = window.cep.fs.showOpenDialog(true, false, 'モーショングラフィックステンプレート', '', ['.mogrt']).data;
    if(mogrtPathList != '') {
        csInterface.evalScript('$._PPP_.ImportMOGRTFile("' + mogrtPathList + '")');
    }
}

function insertSubtitleFromTextarea() {
    const mogrt = document.getElementById("select_mogrt");
    const text = document.getElementById("subtitles");
    const presetTag = $('#preset_tag').val();
    let replaceReg = null;
    if(('#subtitle_replace').val() != '') {
        try {
            replaceReg = new RegExp($('#subtitle_replace').val(), $('#subtitle_replace_flag').val());
        } catch (e) {
            alert(e);
        }
    }
    const replaceAfter = $('#subtitle_replace_after').val();
    csInterface.evalScript('$._PPP_.InsertSubtitle("' + mogrt.value + '","'
    + text.value.slice(text.value.indexOf(presetTag) + 1).replace(/\//g, '').replace(newLineReg, '/').replace(/\"/g, '\\"').replace(replaceReg, replaceAfter) + '")');
}

function insertSubtitleFromTextFile() {
    csInterface.evalScript('$._PPP_.GetTragetAudioClipMediaPath()', function(result){
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
        var mogrt = document.getElementById("select_mogrt");
        csInterface.evalScript('$._PPP_.InsertSubtitle("' + mogrt.value + '","' + textList.join('/') + '")');
    });	
}

function insertSubtitleFromPSD() {
    if($('#psd_import_bin').hasClass('tdact_setting_ok')){
        const importBinTree = $('#psd_import_bin').html();
        const script = makeEvalScript('InsertSubtitle_PSD', importBinTree);
        csInterface.evalScript(script);
    } else {
        setSettingError($('#psd_import_bin'));
    }
}

function SubtitleInitialize() {
    csInterface.addEventListener('completeImportMogrt', function() {
        mogrtUpdate();
    });
}

CustomInitialize['insert_subtitle_initialize'] = function () {
    const category = ExtensionSettings['insert_subtitle'];
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