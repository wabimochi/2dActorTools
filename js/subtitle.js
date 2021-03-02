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
    var csInterface = new CSInterface();
    csInterface.evalScript('$._PPP_.getMGTClipName()', function(names) {
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
    var mogrtPathList = window.cep.fs.showOpenDialog(true, false, 'モーショングラフィックステンプレート', '', ['.mogrt']).data;
    var csInterface = new CSInterface();
    if(mogrtPathList != '') {
        csInterface.evalScript('$._PPP_.importMOGRTFile("' + mogrtPathList + '")');
    }
}

function insertSubtitleFromTextarea() {
    var mogrt = document.getElementById("select_mogrt");
    var text = document.getElementById("subtitles");
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
    var csInterface = new CSInterface();
    csInterface.evalScript('$._PPP_.insertSubtitle("' + mogrt.value + '","'
    + text.value.slice(text.value.indexOf(presetTag) + 1).replace(/\//g, '').replace(newLineReg, '/').replace(/\"/g, '\\"').replace(replaceReg, replaceAfter) + '")');
}

function insertSubtitleFromTextFile() {
    var csInterface = new CSInterface();
    csInterface.evalScript('$._PPP_.getTragetAudioClipMediaPath()', function(result){
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
            console.log(path);
            let text = getText(path);
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
        csInterface.evalScript('$._PPP_.insertSubtitle("' + mogrt.value + '","' + textList.join('/') + '")');
    });	
}

