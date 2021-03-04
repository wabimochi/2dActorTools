$(document).on('click', '.triggerclip_insert_setting', function() {
    const target = $(this);
    enableSwitch(target);
    const category = target.attr('category');
    if(category) {
        const id = target.attr('id');
        let flag = 'enable';
        if(target.hasClass('disable')) flag = 'disable';
        SettingUpdate(category, id, flag);
    }
});

$('#trigger_clip_override_target_seq').on('change', function() {
    const target = $(this);
    const trackNumSelectbox = $('#trigger_clip_override_target_track');
    if(target.val() === '1') {
        videoTrackSelectBox.push($('#trigger_clip_override_target_track'));
        csInterface.evalScript('$._PPP_.sequenceStructureChanged()');
    } else {
        const length = videoTrackSelectBox.length;
        for(let i = 0; i < length; i++){
            if(target.is(videoTrackSelectBox[i])) {
                videoTrackSelectBox.splice(i, 1);
                break;
            }
        }
        if(Number(trackNumSelectbox.attr('max_track_num')) < Number(trackNumSelectbox.attr('select_seq_track'))) {
            trackNumSelectbox.attr('max_track_num', trackNumSelectbox.attr('select_seq_track'));
        };
    }
    const videoTrackNum = trackNumSelectbox.attr('select_seq_track');
    if(videoTrackNum != null && trackNumSelectbox.val() <= videoTrackNum && trackNumSelectbox.val() > 0) {
        setSettingOK(trackNumSelectbox);
        trackNumSelectbox.removeAttr('uk-tooltip');
        trackNumSelectbox.removeAttr('max_track_num');
        while(trackNumSelectbox.children().length - 1 > videoTrackNum) {
            trackNumSelectbox.children().last().remove();
        }
        let value = trackNumSelectbox.children().length;
        while(trackNumSelectbox.children().length <= videoTrackNum) {
            const op = $('<option>', {'value':value});
            op.html(value);
            trackNumSelectbox.append(op);
            value += 1;
        }
    } else {
        setSettingError(trackNumSelectbox);
        if(videoTrackNum != undefined) {
            trackNumSelectbox.attr('uk-tooltip', videoTrackNum + ' 以下を選択してください');
            trackNumSelectbox.attr('max_track_num', videoTrackNum);
        } else {
            trackNumSelectbox.attr('uk-tooltip', 'シーケンスを選択してください');
            trackNumSelectbox.attr('max_track_num', 1);
        }
    }
});

$('#trigger_clip_override_target_track').on('change', function() {
    const selectbox = $(this);
    const max_value = Number(selectbox.attr('max_track_num'));
    const select_value = Number(selectbox.val());
    if(max_value && select_value > max_value || select_value === 0) {
        setSettingError(selectbox);
        if(select_value === 0) {
            selectbox.attr('uk-tooltip', '1 以上を選択してください');
        } else {	
            selectbox.attr('uk-tooltip', max_value + ' 以下を選択してください');
        }
    } else {
        setSettingOK(selectbox);
        selectbox.removeAttr('uk-tooltip');
    }
});

$(document).on('click', '.trigger_clip_trash', function() {
    const treePathButton = $(this).parent().prev();
    treePathButton.html('選択中のクリップをセット');
    treePathButton.removeAttr('uk-tooltip');
    resetSettingFlag(treePathButton);
    const category = treePathButton.attr('category');
    const id = treePathButton.attr('id');
    SettingUpdate(category, id, treePathButton.html());	
});

function triggerOverriteClip_ExecuteButton() {
    const trackNumElm = $('#trigger_clip_override_target_track');
    if(!trackNumElm.hasClass('tdact_setting_ok')) return;

    const startTriggerPathElm = $('#trigger_clipstart_clippath');
    let startTriggerClipTreePath = '';
    if(startTriggerPathElm.hasClass('tdact_setting_ok')) {
        startTriggerClipTreePath = startTriggerPathElm.html();
    }
    const endTriggerPathElm = $('#trigger_clipend_clippath');
    let endTriggerClipTreePath = '';
    if(endTriggerPathElm.hasClass('tdact_setting_ok')) {
        endTriggerClipTreePath = endTriggerPathElm.html();
    }
    const trackNum = trackNumElm.val() - 1;
    const targetSequence = $('#trigger_clip_override_target_seq').val();
    const startClipEndFlag = getClipEndFlag(startTriggerPathElm.parent());    
    const endClipEndFlag = getClipEndFlag(endTriggerPathElm.parent());
    csInterface.evalScript('$._PPP_.triggerClipOverwrite("' + targetSequence + '","' + trackNum + '","' + startTriggerClipTreePath + '","' + endTriggerClipTreePath + '","' + startClipEndFlag + '","' + endClipEndFlag + '")', function() {});
}

CustomInitialize['trigger_clip_custum_initialize'] = function () {
    const category = ExtensionSettings['trigger_clip_override'];
    if(category) {
        const trackIndex = category['trigger_clip_override_target_track'];
        if(trackIndex) { 
            const trackSelectbox = $('#trigger_clip_override_target_track');
            let value = 1;
            while(trackSelectbox.children().length <= trackIndex) {
                const op = $('<option>', {'value':value});
                    op.html(value);
                    trackSelectbox.append(op);
                value += 1;
            }
            trackSelectbox.removeClass('tdact_setting_ok');
            trackSelectbox.attr('max_track_num', 1);
            trackSelectbox.val(trackIndex);
        }

        const clipPathInit = function(path, elm) {
            if(path) {
                elm.html(path);
                csInterface.evalScript('$._PPP_.existClipTreePath("' + path + '")', function(result) {
                    if(result) {
                        elm.attr('uk-tooltip', path);
                        setSettingOK(elm);
                    }
                });
            }
        }
        clipPathInit(category['trigger_clipstart_clippath'], $('#trigger_clipstart_clippath'));
        clipPathInit(category['trigger_clipend_clippath'], $('#trigger_clipend_clippath'));
 
        const merkerInit = function(id) {
            const insert = category[id];
            if(insert) {
                const icon = $('#' + id);
                if(insert == 'enable') {
                    setEnable(icon);
                } else {
                    setDisable(icon);
                }
            }
        }
        merkerInit('trgclp_str_ins_in');
        merkerInit('trgclp_str_ins_out');
        merkerInit('trgclp_str_ins_mkr');
        merkerInit('trgclp_end_ins_in');
        merkerInit('trgclp_end_ins_out');
        merkerInit('trgclp_end_ins_mkr');
    }
    $('#trigger_clip_override_target_seq').change();
}