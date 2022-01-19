const Jimp = require('jimp');

const ACT_ST_actor = 'actor';
const ACT_ST_crop_path = 'crop_path';
const ACT_ST_crop_dir_path = 'crop_dir';
const ACT_ST_src_dir_path = 'src_dir';
const ACT_ST_clipset = 'clipset';
const ACT_ST_version = 'version';
const ACT_ST_lightweight = 'lw';
const ACT_ST_actor_bbox = 'actor_bbox';
const CLIP_TYPE_None = 'none';
const CLIP_TYPE_Animation = 'Anim';

const ACT_ELM_NUM = 4;
const ACT_NAME = 0;
const ACT_BIN_NAME = 1;
const ACT_MEDIA_PATH = 2;
const ACT_TREE_PATH = 3;

const DummyClipTreePath = 'delete';

let ActorIndexForSetting = -1;
let ContextmenuPartsSelectJQElm = null;
let ContextmenuGroupSelectJQElm = null;
let AnimationEditingGroupJQElm = null;
let ActorStructure = [];
let ActorStructurePath = [];
let IsSettingActor = false;
let IsAnimationEditing = false;
let AnimationIndexes = [];

const bakeProgressBarElms = {};

const addFuncList = [];
let actorClipDragula = null;
let clipsetDragula = null;
let groupDragula = null;

$(document).on('click', '.actor_sequence_link.unlink', function() {
    if($('#actor_switcher').hasClass('setting')) return;
    const index = $(this).attr('sequence');
    const actorNameElm = $(this).children('.actor_sequence_link_label');
    const actorName = actorNameElm.html();
    const imported = actorNameElm.attr('imported');
    const actor_sequence_link = $(this);
    const actor_sequence_link_icon = $(this).find('.actor_sequence_link_icon');
    $('.actor_sequence_link').removeClass('enable');
    $('#actor_switcher').find('li').removeClass('uk-active');
    const target_actor_component = $('#actor_switcher').find("[sequence='" + index + "']");
    const actor_root = $('.actor_component[sequence="' + index + '"]');
    
    const script = makeEvalScript('GetActorStructureMediaPath', actorName);
    csInterface.evalScript(script, function(actorStructPath) {
        const _setLink = function(){
            csInterface.evalScript(makeEvalScript('SetLinkSequence', index), function(result) {
                if(result === '0') {
                    actor_sequence_link.addClass('enable');
                    actor_sequence_link.removeClass('unlink');
                    actor_sequence_link.addClass('linked');
                    actor_sequence_link_icon.attr('uk-icon', 'link');
                    target_actor_component.addClass('uk-active');
                    actor_root.empty();

                    SetupActorComponent(index, actorName);
                } else {
                    let errormsg = '';
                    let elm = null;
                    switch(result){
                        case '1':
                            errormsg += 'アクティブシーケンスがありません';
                            break;
                        case '2':
                            break;
                        case '3':
                            errormsg += '複数のクリップを選択しています';
                            elm = $('<div>', {class:'error_info_text', text:'キーを押しながら選択すると、リンクされたシーケンスでも一つずつ選択できます。'});
                            const key = $('<span>', {class:'key_deco', text:`${OSIsWin ? 'Alt' : 'option⌥'}`})
                            elm.prepend(key);
                            break;
                        case '4':
                            errormsg += 'シーケンス以外のクリップを選択しています';
                            const extPath = csInterface.getSystemPath(SystemPath.EXTENSION);
                            elm = $('<div>');
                            elm.append($('<div>', {class:'error_info_text', text:'キャラクターのシーケンスがピンク色になっていませんか？'}));
                            elm.append($('<img>', {src:extPath + '/resource/info1-1.png', style:'display: block;margin-left:auto;margin-right: auto;'}));
                            elm.append($('<div>', {class:'error_info_text', text:'シーケンスは通常緑色になります。左上のアイコンをオンにしてから再度メインのシーケンスに乗せてみてください。'}));
                            elm.append($('<img>', {src:extPath + '/resource/info1-2.png', style:'display: block;margin-left:auto;margin-right: auto;'}));
                            break;
                        default:
                            errormsg += 'Unknown';
                            break;
                    }
                    if(result !== '2') {
                        ErrorNotificationOpen(errormsg, elm);
                    } else {
                        const conf = UIkit.modal.confirm('クリップが選択されていません。シーケンスを作成しますか？', {labels: {cancel: 'キャンセル', ok: '作成する'}, bgClose:true});
                        if(OSIsWin) swapUikitConfirmButton($(conf.dialog.$el));
                        conf.then(function() {
                            const prompt = UIkit.modal.prompt('作成するシーケンス名', actorName, {labels: {cancel: 'キャンセル', ok: 'OK'}});
                            if(OSIsWin) swapUikitConfirmButton($(prompt.dialog.$el));
                            $(prompt.dialog.$el).find('input').addClass('uk-light tdinput');
                            $(prompt.dialog.$el).find('input').css('text-align', 'center');
                            prompt.then(function (seqName) {
                                if(seqName==null) return;

                                let treePath = '';
                                for(let i = 0; i < ActorStructure[index].actor.length; i++) {
                                    let clips = ActorStructure[index].actor[i].clips;
                                    for(let j = 0; j < clips.length; j++){
                                        treePath = clips[j].tree_path;
                                        i = ActorStructure[index].actor.length;
                                        break;
                                    }
                                }
                                let width = 0;
                                let height = 0;
                                if(ActorStructure[index][ACT_ST_lightweight]){
                                    const actor_bbox = ActorStructure[index][ACT_ST_actor_bbox];
                                    width = actor_bbox[2];
                                    height = actor_bbox[3];
                                }

                                const script3 = makeEvalScript('CreateActorSequence', actorName, seqName, treePath, width, height);
                                csInterface.evalScript(script3);
                            });
                        }, function () {});
                    }
                }
            });
        }

        if(actorStructPath === '') {
            if(!imported){
                ImportActor(actorName, index, _setLink);
            }else{
                alert("構成ファイルが見つかりません。立ち絵設定を行ってください");
                ActorIndexForSetting = index;
                StartActorSetting();
            }
        } else {
            if(!LoadActorStructure(actorStructPath, index)) return;
            SetActorSettingPath(actorName, actorStructPath);
            _setLink();
        }
    });
});

$(document).on('click', '.actor_sequence_link.linked', function(e){
    if(e.shiftKey) {
        const isSetting = $('#actor_switcher').hasClass('setting');
        if(!isSetting){
            if(!confirm('シーケンスとのリンクを解除します')){
                return false;
            } else {
                actorDelink($(this));
            }
        }
    } else {
        const index = $(this).attr('sequence');
        $('.actor_sequence_link').removeClass('enable');
        $(this).addClass('enable');
        $('#actor_switcher').find('li').removeClass('uk-active');
        $('#actor_switcher').find(`li[sequence=${index}]`).addClass('uk-active');
        if($(`.actor_sequence_link[sequence=${index}]`).find('.actor_sequence_warning_icon')[0]){
            csInterface.evalScript(makeEvalScript('CheckLinkSequenceFramerate', index));
        }
    }
});

$(document).on('click', '.insert_disable', function() {
    let lock = $(this).attr('uk-icon');
    if(lock === 'lock'){
        $(this).attr('uk-icon', 'unlock');
        $(this).parents('.actor_parts_top').find('.td-thumbnav').removeClass('disable');
    } else {
        $(this).attr('uk-icon', 'lock');
        $(this).parents('.actor_parts_top').find('.td-thumbnav').addClass('disable');
    }
});

$(document).on('click', '.actor_insert_setting', function() {
    enableSwitch($(this));
});

$(document).on('click', '.actor_thumb_parent', function() {
    if($('#actor_switcher').hasClass('setting')) return;
    const linkdActor = $('.actor_sequence_link');
    let actorName = '';
    for(var i = 0; i < linkdActor.length; i++) {
        if(linkdActor.eq(i).hasClass('enable'))
            actorName = linkdActor.eq(i).children('.actor_sequence_link_label').html();
    }
    const target = $(this);
    const tree_path = target.attr('tree_path');
    const group_index = target.attr('group_index');
    const seq_index = $('.actor_linknav > ul > .enable').attr('sequence');
    const insert_mode = target.parents('.parts_selector');
    const flag = getClipEndFlag(insert_mode);
    const type = target.attr('data-type');
    if(type == CLIP_TYPE_None){
        insertActorClip(actorName, seq_index, group_index, tree_path, flag);
    } else if(type == CLIP_TYPE_Animation) {
        const actor_parts_top = target.closest('.actor_parts_top');
        let anim_clips = target.attr('anim_clips');
        let frame = target.attr('frame');
        let sourceIndex = -1;

        const anim_indexes = convertTreePathToAnimationIndex(seq_index, group_index, anim_clips);
        let comment = makeMarkerComment(anim_indexes, frame);
        const animType = actor_parts_top.attr('anim-type');

        if(animType == 0) {
            const interval = target.attr('anim_interval');
            const range = target.attr('anim_range');
            comment += '\\n' + interval.toString() + ',' + range.toString();
        } else if(animType == 1) {
            sourceIndex = Number(actor_parts_top.find('.input_source_track').val()) - 1;
        }

        insertAnimationMarker(seq_index, group_index, comment, flag, animType, sourceIndex);
    }
});

$(document).on('click', '.actor_clipset', function() {
    if($('#actor_switcher').hasClass('setting')) return;
    setActorClipSet($(this).html());
});

$(document).on('mouseenter', '.actor_thumb_parent', function() {
    const actor_label = $(this).parents('.actor_parts_top').find('.select_actor_label');
    actor_label.html($(this).attr('name'));
});
$(document).on('mouseleave ', '.actor_thumb_parent', function() {
    const actor_label = $(this).parents('.actor_parts_top').find('.select_actor_label');
    actor_label.html('');
});

function actorDelink(target, skip_linkseq=''){
    const index = target.attr('sequence');
    const actor_root = $('.actor_component[sequence="' + index + '"]');
    actor_root.empty();
    $('.actor_sequence_link').removeClass('enable');
    target.removeClass('linked');
    target.addClass('unlink');
    target.find('.actor_sequence_link_icon').attr('uk-icon', 'ban');
    target.find('.actor_sequence_warning_icon').remove();
    target.removeAttr('uk-tooltip');
    $('#actor_switcher').find('li').removeClass('uk-active');
    const script = makeEvalScript('DelinkSequence', index, skip_linkseq);
    csInterface.evalScript(script);
}

function makeMarkerComment(anim_indexes, frame){
    frame = frame.split(',').map(x => (Number(x) / 60).toFixed(3));
    const comment = anim_indexes.slice(1).join(',') + '\\n' + 
                frame.slice(1).join(',') + '\\n' +
                anim_indexes.reverse().slice(1).join(',') + '\\n' + 
                frame.reverse().slice(1).join(',');
    return comment;
}

function actorSelectBoxUpdate() {
    const actor_linknav = $('.actor_linknav ul');
    const actor_switcher = $('#actor_switcher');
    actor_linknav.empty();
    actor_switcher.empty();

    csInterface.evalScript('$._PPP_.GetActorBinName()', function(names) {
        const actorHistory = GetActorsHistory();
        if(names.length > 0){
            names = names.split(',');
        } else {
            names = [];
        }

        for(let i = 0; i < names.length; i++){
            while(true){
                const index = actorHistory.indexOf(names[i]);
                if(index > -1){
                    delete actorHistory[index];
                }else{
                    break;
                }
            }
        }
        const nameList = names.concat(actorHistory).filter(Boolean);

        for(let i = 0; i < nameList.length; i++) {
            const act_switch = $('<li>', {'class':'', sequence:i});
            const actor_component = $('<div>', {'class':'actor_component', sequence:i});
            if(OSIsWin){
                new Sortable.create(actor_component[0], {
                    group: 'group',
                    multiDrag: false,
                    draggable: '.dragitem',
                    filter: '.filtered',
                    selectedClass: 'selected',
                    dragClass: 'sortable-drag',
                    ghostClass: 'sortable-ghost',
                    animation: 150,
                    fallbackOnBody: true,
                    swapThreshold: 0.65,
                    dragoverBubble: false});
            } else {
                groupDragula.containers.push(actor_component[0]);
            }
            act_switch.append(actor_component);
            actor_switcher.append(act_switch);

            const li = $('<li>', {'class': 'actor_sequence_link uk-animation-fade uk-width-auto unlink', sequence : i});
            const div_icon = $('<div>', {'class':'actor_sequence_link_icon', 'uk-icon':i < names.length ? 'ban' : ''});
            const div_label = $('<div>', {'class':'actor_sequence_link_label', 'imported':i < names.length ? '1' : ''});
                div_label.html(nameList[i]);
            li.append(div_icon);
            li.append(div_label);
            actor_linknav.append(li);
        }
    });
}

function actorSettingStart(actorName, index) {
    const actorObj = ActorStructure[index];
    csInterface.evalScript('$._PPP_.GetActorStructure("'+ actorName + '")', function(struct) {
        if(struct) {
            const cropDirPath = actorObj[ACT_ST_crop_dir_path];
            const structList = struct.split(',');
            const length = structList.length / ACT_ELM_NUM;
            let prevGroupName = ""
            let prevGroup = null;
            for(let i = 0; i < length; i++) {                
                let currentGroupName = structList[i * ACT_ELM_NUM + ACT_BIN_NAME];
                if(currentGroupName !== prevGroupName){
                    prevGroup = AddPartsBoxGroup(currentGroupName);
                    prevGroupName = currentGroupName;
                }
                if(actorObj.crop_path[structList[i * ACT_ELM_NUM + ACT_TREE_PATH]]){
                    AddActorClip(prevGroup,
                        structList[i * ACT_ELM_NUM + ACT_NAME], 
                        structList[i * ACT_ELM_NUM + ACT_TREE_PATH], 
                        cropDirPath + actorObj.crop_path[structList[i * ACT_ELM_NUM + ACT_TREE_PATH]].path);
                }
            }
        }
    });
}

function setActorClipSet(shortcutKey) {
    const linkdActor = $('.actor_sequence_link');
    for(let i = 0; i < linkdActor.length; i++) {
        if(linkdActor.eq(i).hasClass('enable')) {
            const seqIndex = linkdActor.eq(i).attr('sequence');
            const clipset = ActorStructure[seqIndex][ACT_ST_clipset]; 
            if(!clipset || !clipset[shortcutKey]) return;
            const actorName = linkdActor.eq(i).children('.actor_sequence_link_label').html();
            const actorFlagList = $('#actor_switcher').children('[sequence=' + seqIndex + ']').find('.parts_selector');
            const treePathList = ActorStructure[seqIndex].clipset[shortcutKey].split(',');
            for(let j = 0; j < treePathList.length; j++) {
                const insert_mode = actorFlagList.eq(actorFlagList.length - 1 - j);
                if(!insert_mode.find('.insert_disable').hasClass('enable')) {
                    const flag = getClipEndFlag(insert_mode);
                    if(treePathList[j][0] === '/') {
                        const anim_info = ActorStructure[seqIndex].clipset[treePathList[j].slice(1)];
                        const anim_indexes = convertTreePathToAnimationIndex(seqIndex, j, anim_info.anim_clips);
                        let anim_type = 1;
                        let comment = makeMarkerComment(anim_indexes, anim_info.frame);
                        if(anim_info.interval){
                            comment += '\\n' + anim_info.interval + ',' + anim_info.range;
                            anim_type = 0;
                        }
                        insertAnimationMarker(seqIndex, j, comment, flag, anim_type);
                    } else {
                        insertActorClip(actorName, seqIndex, j, treePathList[j], flag);
                    }
                }
            }
        }
    }
}

function getActorClipSet(shortcutKey) {
    const linkdActor = $('.actor_sequence_link');
    for(let i = 0; i < linkdActor.length; i++) {
        if(linkdActor.eq(i).hasClass('enable')) {
            const seqIndex = linkdActor.eq(i).attr('sequence');
            const actorName = linkdActor.eq(i).children('.actor_sequence_link_label').html();
            csInterface.evalScript('$._PPP_.GetCurrentActorClipTreePath(' + seqIndex + ',-1)', function(treePathList) {
                if(!('clipset' in ActorStructure[seqIndex])){
                    ActorStructure[seqIndex].clipset = {};
                }

                if(!ActorStructure[seqIndex].clipset[shortcutKey]) {
                    const li = $('<li>', {'class':'actor_clipset', text:shortcutKey.toString()});
                    $('#actor_switcher>.uk-active').find('.actor_clipset_root').eq(0).append(li);
                }

                let animIndex;
                let animClipesetCount = 0;
                while((animIndex = treePathList.indexOf('/{')) !== -1) {
                    let endIndex = treePathList.indexOf('}', animIndex);
                    let anim_info = treePathList.substring(animIndex + 1, endIndex + 1);

                    let animClipset = JSON.parse(anim_info);
                    let acKey = shortcutKey + animClipesetCount.toString();
                    animClipesetCount++;
                    ActorStructure[seqIndex].clipset[acKey] = animClipset;
                    treePathList = treePathList.substring(0, animIndex + 1) + acKey + treePathList.substring(endIndex + 1);
                }

                ActorStructure[seqIndex].clipset[shortcutKey] = treePathList;

                csInterface.evalScript('$._PPP_.GetActorStructureMediaPath("' + actorName + '")', function(mediaPath) {
                    if(mediaPath !== '') {
                        const err = SaveJson(ActorStructure[seqIndex], mediaPath);
                        if(err != window.cep.fs.NO_ERROR) {
                            alert(CEP_ERROR_TO_MESSAGE[err]);
                        }
                    }
                });
            });
            break;
        }
    }
}

function insertActorClip(actor_name, seq_index, group_index, tree_path, flag) {
    let bbox = [0, 0, 0, 0];
    let actor_l = 0;
    let actor_t = 0;
    if(ActorStructure[seq_index][ACT_ST_lightweight]){
        if(tree_path !== DummyClipTreePath){
            bbox = ActorStructure[seq_index][ACT_ST_crop_path][tree_path].bbox;
        }
        actor_l =  ActorStructure[seq_index][ACT_ST_actor_bbox][0];
        actor_t =  ActorStructure[seq_index][ACT_ST_actor_bbox][1];
    }
    const script = makeEvalScript('InsertActorClip', actor_name, seq_index, group_index, tree_path, bbox[0], bbox[1], bbox[2], bbox[3], actor_l, actor_t, -1, flag);
    csInterface.evalScript(script);
}

function insertAnimationMarker(seq_index, group_index, comment, flag, type, sourceIndex) {
    let actor_l = 0;
    let actor_t = 0;
    if(ActorStructure[seq_index][ACT_ST_lightweight]){
        actor_l =  ActorStructure[seq_index][ACT_ST_actor_bbox][0];
        actor_t =  ActorStructure[seq_index][ACT_ST_actor_bbox][1];
    }
    const script = makeEvalScript('InsertFrameAnimationMarker', seq_index, group_index, comment, flag, type, sourceIndex, actor_l, actor_t);
    csInterface.evalScript(script);
}

function convertTreePathToAnimationIndex(seq_index, group_index, anim_clips){
    const indexes = AnimationIndexes[seq_index][group_index];
    const result = [];
    const animClips = anim_clips.split(',');
    for(let i = 0; i < animClips.length; i++){
        result.push(indexes.indexOf(animClips[i]));
    }
    return result;
}

function AddPartsBoxGroup(name) {
    const summary = $('<summary>', {class:'group_label'});
    summary.html(name);
    const details = $('<details>', {class:'container uk-animation-slide-left-medium', group:name});
    details.append(summary);
    const div = $('<div>', {style:'text-align: right', class:'actor_parts_container'});
    details.append(div);
    $('#actor_parts_box').append(details);
    if(OSIsWin){
        new Sortable.create(div[0], {
            group: { 
                name: 'actor',
                pull: 'clone',
                put: false,
            },
            multiDrag: true,
            multiDragKey: 'CTRL',
            draggable: '.dragitem',
            filter: '.filtered',
            selectedClass: 'selected',
            dragClass: 'sortable-drag',
            ghostClass: 'sortable-ghost',
            sort: false,
            animation: 150,
            fallbackOnBody: true,
            swapThreshold: 0.65,
            dragoverBubble: false,
        });
    } else {
        actorClipDragula.containers.push(div[0]);
    }
    return div;
}

function AddActorClip(rootNode, name, tree_path, crop_path) {
    if(!fs.existsSync(crop_path)){
        crop_path = '';
    }
    const li = $('<li>', {'class':'actor_thumb_parent dragitem', name:name, tree_path:tree_path, group_index: 0, 'uk-flex':'', 'uk-flex-column':'', 'data-type':CLIP_TYPE_None, 
     'uk-tooltip': 'pos:top-right; duration:0; title:<img class="actor_thumb actor_tooltip thumb_background" src="' + crop_path + '"><div>' + name +'</div>'});

    const img = $('<img>', {'class':'actor_thumb thumb_background fix_size_img'});
    if (crop_path) {
        img.attr('src', crop_path);
        li.append(img);
    } else {
        li.append($('<span>', {'uk-icon':'icon: question; ratio:2'}));
    }
    rootNode.append(li);
}

function HorizontalScroll(e) {
        const amount = 60;
        e.stopPropagation();
        var oEvent = e, 
            direction = oEvent.detail ? oEvent.detail * -amount : oEvent.wheelDelta, 
            position = $(this).scrollLeft();
        position += direction > 0 ? -amount : amount;
        $(this).scrollLeft(position);
        e.preventDefault();
}

function MakeThumbnav(){
    const thumbnav = $('<div>', {'class':'td-thumbnav uk-width-expand'});
    thumbnav[0].addEventListener('mousewheel', HorizontalScroll, { passive: false });
    return thumbnav;
}

function MakeGroupElement(group_name, group_index, clips, crop_dir, crop_path_list, anim_type, anim_source, isSetting) {
    const actor = $('<div>', {'class':'actor_parts_top', group_index: group_index, 'anim-type': anim_type});

    const label = $('<div>', {style:'align-items: center; margin-left:0px;', 'uk-grid':''});
    label.append($('<div>', {'class':'actor_group_tracktxt hidden_at_setting', text:'V' + (group_index + 1).toString()}));

    let hasAnimClip = false;
    for(let j = 0; j < clips.length; j++){
        if(clips[j].type == CLIP_TYPE_Animation){
            hasAnimClip = true;
            break;
        }
    }
    if(hasAnimClip){
        actor.attr('has_anim','');
    }

    const animLabel = $('<div>', {'class':'animation_label', style:'align-items: center;', 'uk-grid':''});
    // const incrementalBakeDiv = $('<div>', {'class':'td-icon-button hidden_at_setting', name:'incremental_bake', 'uk-icon':'icon:bolt; ratio:0.8', style:'height:21px; margin:0 0 0 5px; padding:0 5px 0 5px;'});
    // incrementalBakeDiv.on('click', function(e){
    //     const target = $(this);
    //     const status = enableSwitch(target);
    //     const seq_index = $('.actor_linknav > ul > .enable').attr('sequence');
    //     const group_index = target.closest('.actor_parts_top').attr('group_index');
    //     const source = Number(target.siblings('.input_source_track').val()) - 1;
    //     const enable = status ? 1 : 0;
    //     const script = makeEvalScript('SetIncrementalBakeFlag', seq_index, group_index, source, enable);
    //     csInterface.evalScript(script);
    // });
    // animLabel.append(incrementalBakeDiv);
    animLabel.append($('<div>', {'class':'actor_group_tracktxt hidden_at_setting', text:'Anim:A'}));
    animLabel.append($('<input>', {'class':'input_integer_only uk-light tdinput input_auto_resize input_source_track', type: 'text', value:anim_source}));

    label.append(animLabel);

    if(!hasAnimClip || anim_type != 1 || isSetting){
        animLabel.attr('hidden','');
    }

    const group = $('<div>', {'class':'uk-width-expand select_actor_group'});
    group.html(group_name);
    label.append(group);

    const partsName = $('<div>', {'class':'uk-width-auto uk-text-right select_actor_label'});
    label.append(partsName);
    actor.append(label);

    const partsSelector = $('<div>', {'class':'uk-text-center uk-padding uk-padding-small uk-padding-remove-vertical remove-top-margine parts_selector', style:'margin-left: -40px;'});
    partsSelector.attr('uk-grid', '');
    
    const checkbox_div = $('<div>', {'class':'uk-width-auto uk-height-expand insert_mode expandable', style:'padding-left:40px'});
    checkbox_div.append($('<div>', {'uk-icon': 'unlock', 'class': 'uk-icon actor_insert_setting insert_setting_icon insert_disable'}));
    
    const inpointClipIcon = $('<div>', {'class': 'actor_insert_setting insert_setting_icon insert_inpoint enable'});
        inpointClipIcon.html(SVG_INPOINT_CLIP_ICON);
    const outpointClipIcon = $('<div>', {'class': 'actor_insert_setting insert_setting_icon insert_outpoint disable'});
        outpointClipIcon.html(SVG_OUTPOINT_CLIP_ICON);
    const markerIcon = $('<div>', {'class': 'actor_insert_setting insert_setting_icon insert_marker disable'});
        markerIcon.html(SVG_MARKER_ICON);
        
    const expandButton = $('<div>', {'class': 'actor_gruop_expand_button'});
    expandButton.append($('<div>', {'class': 'actor_gruop_expand_text', 'uk-icon':'icon: chevron-right'}))
    checkbox_div.append(expandButton);
    checkbox_div.append(inpointClipIcon);
    checkbox_div.append(outpointClipIcon);
    checkbox_div.append(markerIcon);

    partsSelector.append(checkbox_div);

    const partsList = $('<div>', {'class':'uk-width-expand uk-flex uk-flex-left actor_parts_list'});
    const thumbnav = MakeThumbnav();

    const ul = $('<ul>', {'class':'uk-flex actor_group'});
    for(let j = 0; j < clips.length; j++){
        if(!crop_path_list[clips[j].tree_path]) continue;
        let type = clips[j].type ? clips[j].type : CLIP_TYPE_None;
        let anim_clips = clips[j].anim_clips ? clips[j].anim_clips : '';
        let frame = 0;
        if(clips[j].frame) {
            frame = clips[j].frame;
        }
        let interval = clips[j].interval ? clips[j].interval : 0;
        let range = clips[j].range ? clips[j].range : 0;
        const li = $('<li>', {'class':'actor_thumb_parent', name:clips[j].clip, tree_path:clips[j].tree_path, group_index: group_index,
         'data-type': type, anim_clips:anim_clips, frame:frame, anim_interval:interval, anim_range:range});
        const img = $('<img>', {'class':'actor_thumb thumb_background fix_size_img'});
        const crop = crop_dir + crop_path_list[clips[j].tree_path].path;
        if (crop && fs.existsSync(crop)) {
            img.attr('src', crop);
            li.append(img);
        } else {
            li.append($('<span>', {'uk-icon':'icon: question; ratio:2', style:'width:max-content;'}));
        }
        ul.append(li);
    }
    const li = $('<li>', {'class':'actor_thumb_parent trash_icon', name:'このクリップを消す', tree_path:'delete', group_index: group_index, trash:'', 'data-type':CLIP_TYPE_None});
    const trash = $('<span>', {'uk-icon':'icon: trash; ratio:2'});
    li.append(trash);
    ul.append(li);

    thumbnav.append(ul);
    partsList.append(thumbnav);
    partsSelector.append(partsList);
    actor.append(partsSelector);
    const progressElm = $('<div>', {class:'td_bake_progress', hidden:''})
    progressElm.append($('<progress>', {'class':'td_progress uk-progress', value: '5', max:'10'}));
    progressElm.append($('<div>', {'class':'', text:''}));
    actor.append(progressElm);

    return actor;
}

async function SetupActorComponent(index, actorName, isSetting=false){
    const actorObj = ActorStructure[index];
    if(actorObj) {
        actor_root = $('.actor_component[sequence="' + index + '"]');

        const thumbnav = MakeThumbnav();
        const ul = $('<ul>', {'class':'uk-flex actor_clipset_root'});
        const clipset = actorObj.clipset;
        for(shortcutKey in clipset){
            if(shortcutKey.length === 1){
                const li = $('<li>', {'class':'actor_clipset', text:shortcutKey.toString()});
                ul.append(li);
            }
        }
        thumbnav.append(ul);
        actor_root.append(thumbnav);
        if(OSIsWin){
            new Sortable.create(ul[0], {
                group: 'clipset',
                multiDrag: true,
                multiDragKey: 'CTRL',
                draggable: '.dragitem',
                filter: '.filtered',
                selectedClass: 'selected',
                dragClass: 'sortable-drag',
                ghostClass: 'sortable-ghost',
                animation: 150,
                fallbackOnBody: true,
                swapThreshold: 0.65,
                dragoverBubble: false
            });
        } else {
            clipsetDragula.containers.push(ul[0]);
        }

        for(let i = 0; i < actorObj.actor.length; i++) {
            const group_index = actorObj.actor.length - 1 - i;
            const actor = MakeGroupElement(
                actorObj.actor[i].group, 
                group_index, 
                actorObj.actor[i].clips,
                actorObj[ACT_ST_crop_dir_path],
                actorObj.crop_path,
                actorObj.actor[i].anim_type,
                actorObj.actor[i].source,
                isSetting);
            actor_root.append(actor);
            if(actorObj.actor[i].anim_type && !isSetting){
                const clips = actorObj.actor[i].clips;
                let treePathList = [];
                for(let j = 0; j < clips.length; j++){
                    if(clips[j].type === CLIP_TYPE_Animation){
                        Array.prototype.push.apply(treePathList, clips[j].anim_clips.split(','));
                   }
                }

                const clipset = actorObj.clipset;
                for(key in clipset){
                    if(key.length === 1){
                        const shortcutClips = clipset[key].split(',');
                        if(shortcutClips.length > group_index){
                            const animKey = shortcutClips[group_index];
                            if(animKey[0] === '/'){
                                const animClipset = clipset[animKey.slice(1)];
                                if(animClipset){
                                    Array.prototype.push.apply(treePathList, animClipset.anim_clips.split(','));
                                }
                            }
                        }
                    }
                }

                if(treePathList.length > 0) {
                    const bbox_list = [];
                    treePathList = Array.from(new Set(treePathList));
                    if(actorObj[ACT_ST_lightweight]){
                        const crop_path = actorObj[ACT_ST_crop_path];
                        for(let j = 0; j < treePathList.length; j++){
                            const bbox = crop_path[treePathList[j]].bbox;
                            bbox_list.push(bbox);
                        }
                    }
                    const script = makeEvalScript('SetupAnimationMarker', actorName, actorObj.actor[i].group, index, group_index, treePathList.join(','), bbox_list.join('\\n'), actorObj[ACT_ST_lightweight]);
                    let mutex = false;
                    csInterface.evalScript(script, function(actorStructPath) {
                        if(!AnimationIndexes[index]) {
                            AnimationIndexes[index] = {};
                        }
                        AnimationIndexes[index][group_index] = actorStructPath.split(',');
                        mutex = true;
                    });
                    while(!mutex) {
                        await sleep(1);
                    };
                }
            }
        }
        $('.input_source_track').change();
    }
}

function LoadActorStructure(path, index) {
    const json = window.cep.fs.readFile(path);
    if(json.err){
        let script = '';
        if(json.err == window.cep.fs.ERR_NOT_FOUND) {
            script = makeEvalScript('MessageWarning', 'ファイルが見つかりません: ' + path.replace(/\\/g, '/'));
        } else {
            script = makeEvalScript('MessageError', 'code ' + json.err.toString() + ' :' + CEP_ERROR_TO_MESSAGE[json.err]);
        }
        csInterface.evalScript(script);
        return false;
    }
    ActorStructure[index] = ActorStructureVersionConvert(JSON.parse(json.data));
    ActorStructurePath[index] = path;
    return true;
}

let cropImageCounter = 0;
let cropImageSize = 0;
let startActorSettingTimeoutId = null;
let startActorSettingCallback = false;
let updateMediaPathTimeoutId = null;
let updateMediaPathCallback = false;
function cropImageCallback(){
    cropImageCounter += 1;
    $('#busy_progress').val(cropImageCounter);
    if(cropImageCounter === cropImageSize){
        const crop_path = ActorStructure[ActorIndexForSetting][ACT_ST_crop_path];
        let actor_l = 0;
        let actor_t = 0;
        let actor_r = 0;
        let actor_b = 0;
        for(key in crop_path){
            const bbox = crop_path[key].bbox;
            if(bbox){
                actor_l = bbox[0];
                actor_t = bbox[1];
                actor_r = bbox[0] + bbox[2];
                actor_b = bbox[1] + bbox[3];
                break;
            }
        }
        for(key in crop_path){
            const bbox = crop_path[key].bbox;
            if(bbox){
                if(actor_l > bbox[0]) actor_l = bbox[0];
                if(actor_t > bbox[1]) actor_t = bbox[1];
                if(actor_r < bbox[0] + bbox[2]) actor_r = bbox[0] + bbox[2];
                if(actor_b < bbox[1] + bbox[3]) actor_b = bbox[1] + bbox[3];
            }
        }
        ActorStructure[ActorIndexForSetting][ACT_ST_actor_bbox] = [actor_l, actor_t, actor_r - actor_l, actor_b - actor_t];
        SaveJson(ActorStructure[ActorIndexForSetting], ActorStructurePath[ActorIndexForSetting]);
        
        BusyNotificationClose();

        if(startActorSettingTimeoutId != null && startActorSettingCallback) {
            clearTimeout(startActorSettingTimeoutId);
            startActorSettingTimeoutId = null;
        }
        if(updateMediaPathTimeoutId != null && updateMediaPathCallback) {
            clearTimeout(updateMediaPathTimeoutId);
            updateMediaPathTimeoutId = null;
        }
        if(startActorSettingCallback){
            startActorSettingCallback = false;
            startActorSettingTimeoutId = setTimeout(_startActorSetting, 300);
        }
        if(updateMediaPathCallback){
            updateMediaPathCallback = false;
            updateMediaPathTimeoutId = setTimeout(UpdateMediaPath, 300);
        }
        if(CropErrorPathList.length > 0 || CropFileNotExistList.length > 0){
            const treePathList = [];
            const div = $('<div>', {text:'サムネイルの作成に失敗したファイルがあります。'});
            const details = $('<details>',{style:'padding: 10px 20px;user-select:text'});
            details.append($('<summary>', {class:'td_summary', text:'ファイル一覧', style:'text-align:left'}));
            for(let i = 0; i < CropErrorPathList.length; i++){
                details.append($('<div>', {text:CropErrorPathList[i].src.replace(/\\/g, '/'), style:'text-align:left'}));
                treePathList.push(CropErrorPathList[i].tree_path);
            }

            for(let i = 0; i < CropFileNotExistList.length; i++){
                details.append($('<div>', {text:CropFileNotExistList[i].src.replace(/\\/g, '/'), style:'text-align:left'}));
            }
            
            div.append(details);

            const info = $('<div>');
            if(CropErrorPathList.length > 0){
                info.append($('<div>', {class:'error_info_text', text:'全て透明な画像などがサムネイル作成に失敗します。'}));
                info.append($('<div>', {class:'tdactor_label',text:'必要な差分の場合'}));
                info.append($('<div>', {text:'元の画像を出力し直してください。上手くいかない場合は出力するアプリを変えてお試しください。'}));
                info.append($('<div>', {class:'tdactor_label',text:'不要な差分の場合'}));
                info.append($('<div>', {text:'プロジェクトから取り除いてください。その他に問題はありません。'}));
                const button_div = $('<div>', {style:'text-align:center; margin-top:10px'});
                const button = $('<button>',{class:'uk-button uk-button-secondary uk-width-auto', text:'プロジェクトから取り除く(元画像は削除されません)'});
                const actorName = GetActorName(ActorIndexForSetting);
                button.click(function(){
                    const script = makeEvalScript('RemoveActorProjectItem', actorName, treePathList.join('\\n'));
                    csInterface.evalScript(script);
                    ErrorNotificationClose();
                });
                button_div.append(button);
                info.append(button_div);
                if(CropFileNotExistList.length > 0){
                    info.append($('<br>'));
                }
            }
            if(CropFileNotExistList.length > 0){
                info.append($('<div>', {class:'error_info_text', text:'見つからない画像があります。'}));
            }
            ErrorNotificationOpen(div, info);
        } else {
            const script = makeEvalScript('MessageInfo', cropImageCounter + '個のサムネイルを作成しました。');
            csInterface.evalScript(script);
        }
    }
}

let CropErrorPathList = [];
let CropFileNotExistList = [];
function save_transparent_crop(crop_info, callback) {
    if(fs.existsSync(crop_info.src)){
        Jimp.read(crop_info.src, (err, image) => {
            if (!err) {
                image.autocrop = autocrop;
                const result = image.autocrop(5);
                if(result === null){
                    CropErrorPathList.push(crop_info);
                    delete ActorStructure[ActorIndexForSetting][ACT_ST_crop_path][crop_info.tree_path];
                } else {
                    const crop_list = ActorStructure[ActorIndexForSetting][ACT_ST_crop_path][crop_info.tree_path];
                    crop_list.bbox = result;
                    image.write(crop_info.dst);
                }
                if(callback) callback();
            } else {
                CropErrorPathList.push(crop_info);
                delete ActorStructure[ActorIndexForSetting][ACT_ST_crop_path][crop_info.tree_path];
            }
        });
    } else {
        CropFileNotExistList.push(crop_info);
        if(callback) callback();
    }
}

$(document).on('click', '.actor_thumb_parent', function(e) {
    if(e.ctrlKey) {
    } else if(e.shiftKey) {
    } else {
        if($('#actor_switcher').hasClass('setting')){   
            const target = $(this);
            if(IsAnimationEditing && target.closest('#actor_switcher').length > 0) {
                $('#animation_editor_root').removeClass('events_disable');
                const prevClip = target.siblings('.anim_selected');
                if(prevClip.length > 0) {
                    SaveAnimationEdit(prevClip);
                }
                $('#animation_editor_thumbnav>ul>li').remove();
                $('.anim_selected').not(this).removeClass('anim_selected');
                target.siblings().addClass('anim_unselect');
                target.addClass('anim_selected');
                target.removeClass('anim_unselect');
                $('.selected').not(this).removeClass('selected');
                target.addClass('selected');
                LoadAnimationEdit(target);
                AnimationPreview_SourceChange(false, true);
            } else {
                $('.selected').not(this).removeClass('selected');
                target.addClass('selected');
            }
        }
    }
});

let previewMediaPathList = [];
let previewDurationList = [];
let previewTimeoutHandle = null;
function AnimationPreview_SourceChange(play=false, view_reset=true){
    previewTimeoutHandle = null;
    previewIndex = 0;
    momentum = 1;

    const treePath = [];
    previewDurationList = [];
    $('#animation_editor_thumbnav').find('li').each((index, elm) => {
        elm = $(elm);
        treePath.push(elm.attr('tree_path'));
        previewDurationList.push(Number(elm.children('input').val()) * 1/60 * 1000);
    });
    const index = $('#actor_switcher>.uk-active').attr('sequence');
    const acotr_name = $('#actor_list_root>ul>[sequence="' + index + '"]>.actor_sequence_link_label').html();
    csInterface.evalScript('$._PPP_.GetActorClipMediaPath("' + acotr_name + '","' + treePath + '")', function(mediaPathList) {
        previewMediaPathList = mediaPathList.split(',');
        Jimp.read(previewMediaPathList[0], (err, image) => {
            if (!err) {
                const rect = getCropSize(image, 5);
                if(rect !== null){
                    SetAnimationPreviewSource(previewMediaPathList, rect, view_reset);
                    if(play){
                        animationPreviewType = $('#select_animation_type').val(); 
                        AnimationPreview_Play();
                    }
                }
            }
        });
    });
}

let previewIndex = 0;
let momentum = 1;
let animationPreviewType = 0;
const animationPreviewChartType1 = [2, 0, 2, 0, 2, 1, 2, 0, 2, 0]
const animationPreviewDurationType1 = [0, 0, 0, 0, 200, 0, 200, 0, 0, 1000]
let previewChartIndex = 0;
function AnimationPreview_Play(){
    let offset = 0;
    if(animationPreviewType == 0){
        // ランダム
        previewIndex += momentum;
        if(previewIndex >= previewMediaPathList.length) {
            previewIndex = previewMediaPathList.length - 2;
            momentum = -1;
        }
        if(previewIndex < 0) {
            previewIndex = 0;
            momentum = 1;
            offset = 1500;
        }
    } else if(animationPreviewType == 1) {
        // リップシンク（開閉）
        if(animationPreviewChartType1[previewChartIndex] === 0){
            previewIndex--;
            if(previewIndex <= 0) {
                previewIndex = 0;
                offset = animationPreviewDurationType1[previewChartIndex];
                previewChartIndex++;
            }
        } else if(animationPreviewChartType1[previewChartIndex] === 1){
            if(previewIndex === 0){
                momentum = 1;
            } else if(previewIndex === previewMediaPathList.length - 1){
                momentum = -1;
            }
            previewIndex += momentum;
            if((momentum === -1 && previewIndex === 1) || 
                (momentum === 1 && previewIndex === previewMediaPathList.length - 1)){
                offset = animationPreviewDurationType1[previewChartIndex];
                previewChartIndex++;
            }
        } else if(animationPreviewChartType1[previewChartIndex] === 2){
            previewIndex++;
            if(previewIndex >= previewMediaPathList.length - 1) {
                previewIndex = previewMediaPathList.length - 1;
                offset = animationPreviewDurationType1[previewChartIndex];
                previewChartIndex++;
            }
        }
        if(previewChartIndex >= animationPreviewChartType1.length){
            previewChartIndex = 0;
        }
    }
    previewTimeoutHandle = setTimeout(AnimationPreview_Play, previewDurationList[previewIndex] + offset);
    AnimationPreviewDraw(previewIndex);
}

function AnimationPreview_Stop(){
    if(previewTimeoutHandle !== null) {
        clearTimeout(previewTimeoutHandle);
        previewTimeoutHandle = null;
    }
}

function SaveAnimationEdit(target_JQElm){
    const root = $('#animation_editor_thumbnav');
    const type = $('#select_animation_type').val();

    target_JQElm.attr('name', $('#animation_editor_name').val());

    let treePath = [];
    let frame = [];
    root.find('li').each(function() { treePath.push($(this).attr('tree_path'))});
    root.find('input').each(function() { frame.push($(this).val())});
    target_JQElm.attr('anim_clips', treePath.join(','));
    target_JQElm.attr('frame', frame.join(','));

    if(type == 0){
        let interval = $('#animation_editor_interval').val();
        let range = $('#animation_editor_random_range').val();
        target_JQElm.attr('anim_interval', interval);
        target_JQElm.attr('anim_range', range);
    }
}
function LoadAnimationEdit(target_JQElm){
    const root = $('#animation_editor_thumbnav>ul');

    $('#animation_editor_name').val(target_JQElm.attr('name'));

    let treePath = [];
    let frame = [];
    let attr = target_JQElm.attr('anim_clips');
    if(attr) treePath = attr.split(',');
    attr = target_JQElm.attr('frame');
    if(attr) frame = attr.split(',');
    const partBoxRoot = $('#actor_parts_box');
    for(let i = 0; i < treePath.length; i++){
        const parts = partBoxRoot.find('[tree_path="' + treePath[i] + '"]');
        const clone = parts.clone().appendTo(root);
        const input = $('<input>', { class: 'input_integer_only uk-light tdinput', type: 'text', placeholder: 'f(60fps)', style: 'display: block; width:56px', onfocus: 'this.select();' });
        clone.append(input);
        input.val(frame[i]);
        clone.removeAttr('uk-tooltip');
    }
    $('#animation_editor_thumbnail>ul>li').remove();
    const thumbParts = partBoxRoot.find('[tree_path="' + target_JQElm.attr('tree_path') + '"]');
    const thumbnail = thumbParts.clone().appendTo($('#animation_editor_thumbnail>ul'));
    thumbnail.removeAttr('uk-tooltip');

    let interval = target_JQElm.attr('anim_interval');
    let range = target_JQElm.attr('anim_range');
    $('#animation_editor_interval').val(interval);
    $('#animation_editor_random_range').val(range);
}

let StartSettingActorName = '';
let BusyNotificationProgress = null;
function _startActorSetting() {
    IsSettingActor = true;
    startActorSettingTimeoutId = null;
    const actorName = StartSettingActorName;

    const actor_sequence_link = $('.actor_sequence_link');
    const target = $(".actor_sequence_link[sequence='" + ActorIndexForSetting + "']");

    actor_sequence_link.removeClass('enable');
    target.addClass('enable');

    $('#actor_parts_box').removeAttr('hidden');
    actor_sequence_link.not('[sequence=' + ActorIndexForSetting + ']').attr('hidden', '');
    $('#actor_setting_save_button').removeAttr('hidden');
    $('#actor_setting_cancel_button').removeAttr('hidden');
    $('#actor_setting_start_button').addClass('events_disable');
    $('#actor_parts_box').removeAttr('hidden');
    $('#actor_switcher').find('[sequence]').removeClass('uk-active');
    const targetActorPanel = $('#actor_switcher').find("[sequence='" + ActorIndexForSetting + "']");
    targetActorPanel.addClass('uk-active');
    targetActorPanel.find('.animation_label').attr('hidden','');
    if(target.hasClass('unlink')) {
        SetupActorComponent(ActorIndexForSetting, actorName, true);
    }
    let actor_sequence_link_icon = target.find('.actor_sequence_link_icon');
    actor_sequence_link_icon.attr('uk-icon', 'cog');

    SetupActorSettingUI();
    actorSettingStart(actorName, ActorIndexForSetting);
}

function StartActorSetting() {
    const actorName = GetActorName(ActorIndexForSetting);
    StartSettingActorName = actorName;
    const script = makeEvalScript('GetActorStructureAndMediaPath', actorName);
    csInterface.evalScript(script, function(result) {
        result = result.split('\n');
        const actorStructPath = result[0];
        const struct = result[1];
        if(actorStructPath === '') {
            if(struct) {
                let new_actor_structure = {};
                const structList = struct.split(',');
                const length = structList.length / ACT_ELM_NUM;
                let prevGroupName = ""
                let actor = [];
                let group_obj = {};
                let saveCropPathList = {};
                const crop_list = [];
                
                save_structure_file_path = window.cep.fs.showSaveDialogEx('構成ファイルの保存先', '', ['txt'], actorName + '.txt').data;
                if(!save_structure_file_path) return;
                save_structure_file_path = save_structure_file_path.replace(/\\/g, '/');
                ActorStructurePath[ActorIndexForSetting] = save_structure_file_path;

                let crop_dir = window.cep.fs.showOpenDialogEx(false, true, 'サムネイルの保存先', null).data;
                if(crop_dir == '') return;
                crop_dir += '/';

                let source_dir = '';
                for(let i = 0; i < length; i++) {
                    let currentGroupName = structList[i * ACT_ELM_NUM + ACT_BIN_NAME];
                    if(currentGroupName !== prevGroupName){
                        if(Object.keys(group_obj).length > 0) {
                            actor.push(group_obj);
                        }
                        group_obj = { 
                            group : currentGroupName,
                            clips : []
                        };
                        prevGroupName = currentGroupName;
                    }
                    const clip_obj = {
                        clip: structList[i * ACT_ELM_NUM + ACT_NAME],
                        tree_path: structList[i * ACT_ELM_NUM + ACT_TREE_PATH]
                    };
                    group_obj.clips.push(clip_obj);
                    let src_path = structList[i * ACT_ELM_NUM + ACT_MEDIA_PATH];
                    let lastIndex = src_path.lastIndexOf(".");
                    let crop_path = structList[i * ACT_ELM_NUM + ACT_NAME] + GetUUID() + src_path.substr(lastIndex);
                    const key = structList[i * ACT_ELM_NUM + ACT_TREE_PATH];
                    crop_list.push({tree_path:key, src:src_path, dst:crop_dir + crop_path});
                    saveCropPathList[key] = {path:crop_path};
                    if(source_dir !== ''){
                        const _source_dir = path_js.dirname(src_path) + '/';
                        if(_source_dir.length < source_dir.length){
                            source_dir = _source_dir;
                        }
                    }else{
                        source_dir = path_js.dirname(src_path) + '/';
                    }
                }

                new_actor_structure[ACT_ST_src_dir_path] = source_dir;
                for(let i = 0; i < length; i++) {
                    const key = structList[i * ACT_ELM_NUM + ACT_TREE_PATH];
                    const src_path = structList[i * ACT_ELM_NUM + ACT_MEDIA_PATH];
                    saveCropPathList[key].src = src_path.replace(source_dir, '');
                }

                if(Object.keys(group_obj).length > 0) {
                    actor.push(group_obj);
                }

                new_actor_structure[ACT_ST_lightweight] = 0;
                new_actor_structure[ACT_ST_actor] = actor;
                new_actor_structure[ACT_ST_crop_dir_path] = crop_dir;
                new_actor_structure[ACT_ST_crop_path] = saveCropPathList;
                new_actor_structure[ACT_ST_version] = 2;

                // クロップイメージの作成
                startActorSettingCallback = true;
                MakeThumbnail(crop_list);

                ActorStructure[ActorIndexForSetting] = new_actor_structure;
                SetActorSettingPath(actorName, ActorStructurePath[ActorIndexForSetting]);

                csInterface.evalScript('$._PPP_.ImportActorStructureFile("' + save_structure_file_path.replace(/\\/g, '/') + '","'+ actorName + '")', function(result) {
                    if(!result) {
                        alert('構成ファイルのインポートに失敗しました');
                        return;
                    }
                    if(crop_list.length === 0){
                        SaveJson(ActorStructure[ActorIndexForSetting], ActorStructurePath[ActorIndexForSetting]);
                        _startActorSetting();
                    }
                });
            } 
        } else {
            SetActorSettingPath(actorName, actorStructPath);
            if(LoadActorStructure(actorStructPath, ActorIndexForSetting)){
                const structList = struct.split(',');
                const length = Math.floor(structList.length / ACT_ELM_NUM);
                let source_dir = ActorStructure[ActorIndexForSetting][ACT_ST_src_dir_path];
                const crop_dir = ActorStructure[ActorIndexForSetting][ACT_ST_crop_dir_path];

                const cropPathList = ActorStructure[ActorIndexForSetting][ACT_ST_crop_path];
                const append_crop_list = [];

                for(let i = 0; i < length; i++) {
                    const src_path = structList[i * ACT_ELM_NUM + ACT_MEDIA_PATH];
                    const _source_dir = path_js.dirname(src_path) + '/';
                    if(!source_dir || _source_dir.length < source_dir.length){
                        source_dir = _source_dir;
                    }
                }

                old_source_dir = ActorStructure[ActorIndexForSetting][ACT_ST_src_dir_path];
                ActorStructure[ActorIndexForSetting][ACT_ST_src_dir_path] = source_dir;

                for(let i = 0; i < length; i++) {
                    const key = structList[i * ACT_ELM_NUM + ACT_TREE_PATH];
                    if(cropPathList[key] && fs.existsSync(crop_dir + cropPathList[key].path)){
                        if(!cropPathList[key].src){
                            const src_path = structList[i * ACT_ELM_NUM + ACT_MEDIA_PATH];
                            cropPathList[key].src = src_path.replace(source_dir, '');
                        } else {
                            const src_path = old_source_dir + cropPathList[key].src;
                            cropPathList[key].src = src_path.replace(source_dir, '');
                        }
                    } else {
                        let src_path = '';
                        if(cropPathList[key] && fs.existsSync(old_source_dir + cropPathList[key].src)){
                            src_path = old_source_dir + cropPathList[key].src;
                        } else {
                            src_path = structList[i * ACT_ELM_NUM + ACT_MEDIA_PATH];
                        }

                        const lastIndex = src_path.lastIndexOf(".");
                        const crop_path = structList[i * ACT_ELM_NUM + ACT_NAME] + GetUUID() + src_path.substr(lastIndex);
                        cropPathList[key] = {path:crop_path, src:src_path.replace(source_dir, '')}
                        append_crop_list.push({tree_path:key, src:src_path, dst:crop_dir + crop_path});
                    }
                }

                startActorSettingCallback = true;
                MakeThumbnail(append_crop_list);
            }
        }
    });
}

function MakeThumbnail(crop_list, notification=false){
    cropImageCounter = 0;
    cropImageSize = crop_list.length;
    if(cropImageSize > 0) {
        BusyNotificationOpen('サムネイル用画像の処理中', cropImageSize);
        CropErrorPathList = [];
        CropFileNotExistList = [];
        for(let i = 0; i < cropImageSize; i++) {
            requestIdleCallback(() => save_transparent_crop(crop_list[i], cropImageCallback));
        }
    } else{
        if(notification){
            const script = makeEvalScript('MessageInfo', 'サムネイルの作成が完了しました。');
            csInterface.evalScript(script);
        }
        if(startActorSettingCallback){
            startActorSettingCallback = false;
            _startActorSetting();
        }
        if(updateMediaPathCallback){
            updateMediaPathCallback = false;
            UpdateMediaPath();
        }
    }
}

function SortableCreateActor(groupElm, pullAction=true, onAddFunc=null){
    if(OSIsWin){
        new Sortable.create(groupElm, {
            group: {
                name: 'actor',
                pull: pullAction,
            },
            multiDrag: true,
            multiDragKey: 'CTRL',
            draggable: '.dragitem',
            filter: '.filtered',
            selectedClass: 'selected',
            dragClass: 'sortable-drag',
            ghostClass: 'sortable-ghost',
            animation: 150,
            fallbackOnBody: true,
            swapThreshold: 0.65,
            dragoverBubble: false,
            onAdd: function (evt) {
                var jqElm = $(evt.item);
                jqElm.removeAttr('uk-tooltip');
                jqElm.siblings('[uk-tooltip]').removeAttr('uk-tooltip');

                if(onAddFunc) onAddFunc(evt);
            }
        });
    } else {
        actorClipDragula.containers.push(groupElm);
        addFuncList.push({el:groupElm, func:onAddFunc});
    }
}

function ActorPartsToSetting(actor_parts_top_jqelm){
    actor_parts_top_jqelm.addClass('dragitem');
    actor_parts_top_jqelm.find('.select_actor_group').attr('contenteditable', 'true');
    actor_parts_top_jqelm.find('.select_actor_group').addClass('tdinput');
    actor_parts_top_jqelm.find('.hidden_at_setting').attr('hidden', '');

    const actor_thumb_parent = actor_parts_top_jqelm.find('.actor_thumb_parent');
    actor_thumb_parent.each(function() {
        if ($(this).attr('trash') == undefined) {
            $(this).addClass('dragitem');
        } else {
            $(this).attr('hidden', '');
        }
    });
}

function SetupActorSettingUI() {
    const actor_component_root = $(".actor_component[sequence='" + ActorIndexForSetting + "']");

    const lightweight_elm = $('<label>', {'class':'input_label', 'text':'サムネイルを使用して描画コストを減らす'});
    const lightweight_check = $('<input>', {id:'lightweight_check', 'class':'uk-checkbox', 'type':'checkbox'});
    lightweight_elm.prepend(lightweight_check);
    actor_component_root.before(lightweight_elm);
    if(ActorStructure[ActorIndexForSetting][ACT_ST_lightweight]){
        lightweight_check.prop('checked', true);
    }
    actor_component_root.before(actor_component_root.find('div:has(.actor_clipset_root)'));

    let containers = actor_component_root[0].querySelectorAll('.actor_group');
    for (let i = 0; i < containers.length; i++) {
        SortableCreateActor(containers[i], true, OnAddAnimationSetting);
    };
    $('#actor_switcher').addClass('setting');
    actor_component_root.find('.actor_parts_top').each(function() {
        ActorPartsToSetting($(this));
    });
    $('.actor_clipset').addClass('dragitem');
}

function SaveActorSetting() {
    const current_actor_structure = ActorStructure[ActorIndexForSetting];
    const actor_root = $('.actor_component[sequence="' + ActorIndexForSetting + '"]');

    let new_actor_structure = {};
    let actor = [];
    const groupList = actor_root.find('.actor_parts_top');
    for(let i = 0; i < groupList.length; i++) {
        const groupElm = groupList.eq(i);
        const group_obj = { 
            group : groupElm.find('.select_actor_group').html(),
            clips : [],
            anim_type : groupElm.attr('anim-type'),
            source : groupElm.find('.input_source_track').val()
        };
        const clips = groupElm.find('.actor_thumb_parent');
        for(let j = 0; j < clips.length; j++) {
            const clipElm = clips.eq(j);
            if(clipElm.attr('trash') == undefined)
            {
                if(clipElm.attr('data-type') == CLIP_TYPE_Animation) {
                    group_obj.clips.push({
                        type: CLIP_TYPE_Animation,
                        clip: clipElm.attr('name'),
                        tree_path: clipElm.attr('tree_path'),
                        anim_clips: clipElm.attr('anim_clips'),
                        frame: clipElm.attr('frame'),
                        interval: clipElm.attr('anim_interval'),
                        range: clipElm.attr('anim_range')
                    });
                } else {
                    group_obj.clips.push({
                        clip: clipElm.attr('name'),
                        tree_path: clipElm.attr('tree_path')
                    });
                }
            }
        }
        actor.push(group_obj);
    }
    new_actor_structure[ACT_ST_actor] = actor;
    if(current_actor_structure[ACT_ST_clipset]) {
        const current_clip_set = current_actor_structure[ACT_ST_clipset];
        const new_clip_set = {};
        $(`#actor_switcher>[sequence=${ActorIndexForSetting}]>div>.actor_clipset_root>.actor_clipset`).each(function(){
            new_clip_set[$(this).html()] = current_clip_set[$(this).html()];
        });
        new_actor_structure[ACT_ST_clipset] = new_clip_set;
    }
    new_actor_structure[ACT_ST_crop_path] = current_actor_structure[ACT_ST_crop_path];
    new_actor_structure[ACT_ST_crop_dir_path] = current_actor_structure[ACT_ST_crop_dir_path];
    new_actor_structure[ACT_ST_src_dir_path] = current_actor_structure[ACT_ST_src_dir_path];
    new_actor_structure[ACT_ST_version] = current_actor_structure[ACT_ST_version];
    if($('#lightweight_check').prop('checked')){
        new_actor_structure[ACT_ST_lightweight] = 1;
    } else {
        new_actor_structure[ACT_ST_lightweight] = 0;
    }
    new_actor_structure[ACT_ST_actor_bbox] = current_actor_structure[ACT_ST_actor_bbox];

    ActorStructure[ActorIndexForSetting] = new_actor_structure;
    SaveJson(ActorStructure[ActorIndexForSetting], ActorStructurePath[ActorIndexForSetting]);
    UpdateGroupIndex();
    ActorSettingEnd();

    updateMediaPathCallback = true;
    UpdateMediaPathActorIndex = ActorIndexForSetting;
    ThumbnailGenerator(ActorIndexForSetting, true);
}

function ThumbnailGenerator(actor_index, bbox=false, notification=false){
    const actorName = GetActorName(actor_index);
    let script = makeEvalScript('GetActorStructureMediaPath', actorName);
    csInterface.evalScript(script, function(actorStructPath) {
        if(actorStructPath !== '') {
            if(!LoadActorStructure(actorStructPath, actor_index)) return;       
            script = makeEvalScript('GetActorStructure', actorName);
            csInterface.evalScript(script, function(struct){
                if(!struct) return;

                const srcList = {};    
                const structList = struct.split(',');
                const length = structList.length / ACT_ELM_NUM;
                for(let i = 0; i < length; i++) {
                    srcList[structList[i * ACT_ELM_NUM + ACT_TREE_PATH]] = [structList[i * ACT_ELM_NUM + ACT_NAME], structList[i * ACT_ELM_NUM + ACT_MEDIA_PATH]];
                }
                
                let crop_dir = null;
                const crop_list = [];
                const actorStructure = ActorStructure[actor_index];
                const cropPathList = actorStructure[ACT_ST_crop_path];
                const cropDirPath = actorStructure[ACT_ST_crop_dir_path];
                const srcDirPath = actorStructure[ACT_ST_src_dir_path];
                if(!bbox){
                    for(key in cropPathList){
                        const cropPath = cropDirPath + cropPathList[key].path;
                        if(fs.existsSync(cropPath)){
                            delete srcList[key];
                            if(crop_dir === null){
                                crop_dir = cropDirPath;
                            }
                        } else {
                            const srcPath = srcDirPath + cropPathList[key].src;
                            if(fs.existsSync(srcPath)){
                                srcList[key][1] = srcPath;
                            }
                        }
                    }

                    if(crop_dir == null){    
                        crop_dir = window.cep.fs.showOpenDialogEx(false, true, 'サムネイルの保存先', null).data;
                        if(crop_dir == '') return;
                        crop_dir += '/';
                        actorStructure[ACT_ST_crop_dir_path] = crop_dir;
                    }

                    for(key in srcList){
                        let src_path = srcList[key][1];
                        let lastIndex = src_path.lastIndexOf(".");
                        let crop_path = srcList[key][0] + GetUUID() + src_path.substr(lastIndex);
                        crop_list.push({tree_path:key, src:src_path, dst:crop_dir + crop_path});
                        cropPathList[key].path = crop_path;
                    }
                } else {
                    for(key in srcList){
                        if(cropPathList[key]){
                            const src_path = srcList[key][1];
                            const cropPath = cropDirPath + cropPathList[key].path;
                            if(!fs.existsSync(cropPath) || !cropPathList[key].bbox){
                                const lastIndex = src_path.lastIndexOf(".");
                                const crop_path = srcList[key][0] + GetUUID() + src_path.substr(lastIndex);
                                cropPathList[key].path = crop_path;
                                crop_list.push({tree_path:key, src:src_path, dst:cropDirPath + cropPathList[key].path});
                            }
                        }
                    }
                }
                MakeThumbnail(crop_list, notification);
            });
        } else {
            alert("構成ファイルが見つかりません。立ち絵設定を行ってください");
            StartActorSetting();
        };
    });
}

function ActorSettingEnd(){
    IsSettingActor = false;

    $('#actor_parts_box').attr('hidden', '');
    $('#actor_setting_save_button').attr('hidden', '');
    $('#actor_setting_cancel_button').attr('hidden', '');
    $('#actor_setting_start_button').removeClass('events_disable');
    $('.hidden_at_setting').removeAttr('hidden');
    $('.dragitem').removeClass('.dragitem');
    $('#actor_switcher').removeClass('setting');
    $('#actor_parts_box').html('');

    $('#lightweight_check').parent().remove();
    $(`#actor_switcher>[sequence=${ActorIndexForSetting}]>div:has(.actor_clipset_root)`).remove();

    const target = $(".actor_sequence_link[sequence='" + ActorIndexForSetting + "']");
    let actor_sequence_link_icon = target.find('.actor_sequence_link_icon');
    const actor_root = $('.actor_component[sequence="' + ActorIndexForSetting + '"]');
    actor_root.empty();
    if(target.hasClass('unlink')) {
        actor_sequence_link_icon.attr('uk-icon', 'ban');
        target.removeClass('enable');
    } else {
        actor_sequence_link_icon.attr('uk-icon', 'link');
        actorDelink(target, true);
        target.click();
    }
    $('.actor_sequence_link').removeAttr('hidden');
    $('[trash]').removeAttr('hidden');
}

function OnAddAnimationSetting(evt){
    if(IsAnimationEditing){
        const target = $(evt.item);
        target.removeClass('dragitem');
        target.attr('data-type', CLIP_TYPE_Animation);
        target.trigger('click');
    }
}

function AnimationSettingEnd() {
    AnimationPreview_Stop();

    const type = $('#select_animation_type').val();
    AnimationEditingGroupJQElm.attr('anim-type', type);

    const prevClip = AnimationEditingGroupJQElm.find('.anim_selected');
    if(prevClip.length > 0) {
        SaveAnimationEdit(prevClip);
    }

    if(actorClipDragula) actorClipDragula = [];
    if(clipsetDragula) clipsetDragula = [];
    if(groupDragula) groupDragula = [];

    AnimationEditingGroupJQElm.find('.anim_selected').removeClass('anim_selected');
    AnimationEditingGroupJQElm.find('.anim_unselect').removeClass('anim_unselect');
    AnimationEditingGroupJQElm.find('.selected').removeClass('selected');
    AnimationEditingGroupJQElm.siblings().removeAttr('hidden');
    const clips = AnimationEditingGroupJQElm.find('.actor_thumb_parent');
    clips.addClass('dragitem');
    clips.filter('[data-type!=' + CLIP_TYPE_Animation + ']:not(.trash_icon)').removeAttr('hidden');
    AnimationEditingGroupJQElm.addClass('dragitem');
    AnimationEditingGroupJQElm.find('.td-thumbnav').removeClass('dragdrop-area-bg');
    $('#animation_editor_name').val('');
    $('#animation_editor_thumbnav>ul>li').remove();
    $('#animation_editor_thumbnail>ul>li').remove();
    $('#animation_editor_interval').val('');
    $('#animation_editor_random_min').val('');
    $('#animation_editor_random_max').val('');
    $('#actor_setting_add_animation_clip_button').attr('hidden','');
    $('#animation_editor_root').attr('hidden','');
    $('#animation_type_root').attr('hidden','');
    $('#actor_setting_save_button').removeAttr('hidden');
    $('#actor_setting_cancel_button').removeAttr('hidden');
    $('#actor_setting_animation_end_button').attr('hidden', '');
    IsAnimationEditing = false;
}

let UpdateMediaPathActorIndex = 0;
function UpdateMediaPath(callback){
    const index = UpdateMediaPathActorIndex;
    const actorName = GetActorName(index);
    const script = makeEvalScript('GetActorStructureAndMediaPath', actorName);
    csInterface.evalScript(script, function(result) {
        if(!result){
            callback(false);
            return;
        }
        result = result.split('\n');
        const actorStructPath = result[0];
        const struct = result[1];

        if(!LoadActorStructure(actorStructPath, index)) {
            if(callback) callback(false);
            return;
        }
        // Media pathの変更
        const structList = struct.split(',');
        const length = structList.length / ACT_ELM_NUM;
        const lightweight = ActorStructure[index][ACT_ST_lightweight];
        const source_dir = ActorStructure[index][ACT_ST_src_dir_path];
        const crop_dir = ActorStructure[index][ACT_ST_crop_dir_path];
        const crop_list = ActorStructure[index][ACT_ST_crop_path];
        const change_key_list = [];
        const change_src_list = [];
        for(let i = 0; i < length; i++) {
            const key = structList[i * ACT_ELM_NUM + ACT_TREE_PATH];
            if(crop_list[key]){
                const current_src_path = structList[i * ACT_ELM_NUM + ACT_MEDIA_PATH];
                let correct_src_path = '';
                if(lightweight){
                    correct_src_path = crop_dir + crop_list[key].path;
                } else {
                    correct_src_path = source_dir + crop_list[key].src;
                }
                if(correct_src_path !== current_src_path && fs.existsSync(correct_src_path)){
                    change_key_list.push(key);
                    change_src_list.push(correct_src_path);
                }
            }
        }

        if(change_key_list.length > 0){
            BusyNotificationOpen('メディアパスを変更しています', change_key_list.length);
            const script2 = makeEvalScript('ChangeMediaPathForLightweight', actorName, change_key_list.join('\\n'), change_src_list.join('\\n'));
            csInterface.evalScript(script2, function(result) {
                BusyNotificationClose();
                if(callback) callback(true);
            });
        }else {
            if(callback) callback(true);
        }
    });
}

function ActorStructureVersionConvert(actor_structure) {
    if(!actor_structure.version) {
        actor_structure = ActorStructureVersionConvert1(actor_structure);
    }
    if(actor_structure.version === 1) {
        actor_structure = ActorStructureVersionConvert2(actor_structure);
    }
    return actor_structure;
}

function ActorStructureVersionConvert1(version0_structure) {
    let version1 = {...version0_structure};
    let crop_path = {};
    for(let i = 0; i < version1.actor.length; i++) {
        const clips = version1.actor[i].clips;
        for(let j = 0; j < clips.length; j++) {
            crop_path[clips[j].tree_path] = clips[j].crop_path;
            delete clips[j].crop_path;
            delete clips[j].src_path;
        }
    }
    version1.actor.pop();
    version1[ACT_ST_crop_path] = crop_path;
    version1[ACT_ST_version] = 1;
    return version1;
}
function ActorStructureVersionConvert2(version1_structure) {
    let version2 = {...version1_structure};
    const crop_list = version2[ACT_ST_crop_path];
    const new_crop_list = {};
    
    let crop_dir = null;
    for(key in crop_list){
        if(crop_dir === null){
            crop_dir = path_js.dirname(crop_list[key]) + '/';
        }
        const new_crop = {path:path_js.basename(crop_list[key])};
        new_crop_list[key] = new_crop;
    }
    version2[ACT_ST_lightweight] = 0;
    version2[ACT_ST_crop_dir_path] = crop_dir;
    version2[ACT_ST_crop_path] = new_crop_list;
    version2[ACT_ST_src_dir_path] = '';

    version2[ACT_ST_version] = 2;
    return version2;
}

function UpdateGroupIndex() {
    const groupList = $('#actor_switcher .actor_parts_top');
    for(let i = 0; i < groupList.length; i++) {
        const groupElm = groupList.eq(i);
        const clips = groupElm.find('.actor_thumb_parent');
        for(let j = 0; j < clips.length; j++) {
            clips.eq(j).attr('group_index', groupList.length - 1 - i);
        }
    }
}

function GetActorName(index){
    const target = $(".actor_sequence_link[sequence='" + index + "']");
    return target.children('.actor_sequence_link_label').html();
}

function IsActorImported(index){
    const target = $(".actor_sequence_link[sequence='" + index + "']");
    return target.children('.actor_sequence_link_label').attr('imported');
}

function ImportActor(actorName, index, callback){
    const actorStructPath = GetActorSettingPath(actorName);
    if(!LoadActorStructure(actorStructPath, index)) return;

    const isLightweight = ActorStructure[index][ACT_ST_lightweight];
    const crop_path = ActorStructure[index][ACT_ST_crop_path];
    const src_dir = ActorStructure[index][ACT_ST_src_dir_path];
    const crop_dir = ActorStructure[index][ACT_ST_crop_dir_path];
    const importPathList = [];
    const treePathLiist = [];
    const notFoundList = [];
    for(key in crop_path){
        let path = '';
        if(isLightweight){
            path = crop_dir + crop_path[key].path;
        }else{
            path = src_dir + crop_path[key].src;
        }
        if(fs.existsSync(path)){
            importPathList.push(path);
            treePathLiist.push(key);
        } else {
            notFoundList.push(path);
        }
    }

    const _import = function(){
        BusyNotificationOpen('キャラクターのクリップをインポートしています');
        const script = makeEvalScript('ImportActor', actorName, actorStructPath, treePathLiist.join('\\n'), importPathList.join('\\n'));
        csInterface.evalScript(script, function (result){
            BusyNotificationClose();
            const target = $(".actor_sequence_link[sequence='" + index + "']");
            target.children('.actor_sequence_link_label').attr('imported', '1');
            if(callback){
                callback();
            }
        });
    }

    if(notFoundList.length > 0){
        const div = $('<div>', {text:`${Object.keys(crop_path).length}ファイル中、以下の${notFoundList.length}ファイルが見つからないためインポートできませんでした。`});
        const details = $('<details>',{style:'padding: 10px 20px;user-select:text'});
        details.append($('<summary>', {class:'td_summary', text:'ファイル一覧', style:'text-align:left'}));
        for(let i = 0; i < notFoundList.length; i++){
            details.append($('<div>', {text:notFoundList[i], style:'text-align:left'}));
        }
        div.append(details);

        let info = null;
        if(isLightweight){
            info = $('<div>',{class:'error_info_text', text:'軽量化中の立ち絵です。設定を変更してオリジナルのファイルをインポートできます。'});
            const button_div = $('<div>', {style:'text-align:center; margin-top:10px'});
            const button1 = $('<button>',{class:'uk-button uk-button-secondary uk-width-auto', text:'存在するファイルだけインポートする', style:'margin: 10px 10px'});
            button1.click(function(){
                ErrorNotificationClose();
                _import();
            });
            button_div.append(button1);

            const button2 = $('<button>',{class:'uk-button uk-button-secondary uk-width-auto', text:'オリジナルのファイルをインポートする', style:'margin: 10px 10px'});
            button2.click(function(){
                ActorStructure[index][ACT_ST_lightweight] = 0;
                SaveJson(ActorStructure[ActorIndexForSetting], ActorStructurePath[ActorIndexForSetting]);
                ErrorNotificationClose();
                ImportActor(actorName, index, callback);
            });
            button_div.append(button2);
            info.append(button_div);
        } else {
            _import();
        }

        ErrorNotificationOpen(div, info);
    } else {
        _import();
    }
}

function ActorEditInitialize() {
    if(!OSIsWin){
        actorClipDragula = dragula({
			moves: function(el, container, target) {
                return IsSettingActor;
            },
            copy: function (el, source) {
                return source.classList.contains('actor_parts_container');
            },
            accepts: function (el, target) {
                return !target.classList.contains('actor_parts_container');
            }
        }).on('drop', function (el, target, source) {
            var jqElm = $(el);
            jqElm.removeAttr('uk-tooltip');
            jqElm.siblings('[uk-tooltip]').removeAttr('uk-tooltip');
            for(let i = 0; i < addFuncList.length; i++){
                if(addFuncList[i].el === target){
                    const evt = {item:el};
                    addFuncList[i].func(evt);
                    break;
                }
            }
        });
        clipsetDragula = dragula({
            moves: function(el, container, target) {
                return IsSettingActor;
            }
        });
        groupDragula = dragula({
			moves: function(el, container, target) {
				return !target.classList.contains('actor_thumb') && target.tagName !== 'LABEL' && IsSettingActor;
			}
		});
    }

    let contextmenus = $('.contextmenu');
    $(document).on('contextmenu', '.actor_sequence_link', function (e) {
        contextmenus.removeClass('contextmenu_show');
        let actor_contextmenu = $('#actor_contextmenu');
        actor_contextmenu.css('left', e.pageX-window.scrollX + 'px');
        actor_contextmenu.css('top', e.pageY-window.scrollY + 'px');
        actor_contextmenu.addClass('contextmenu_show');
        ActorIndexForSetting = Number($(this).attr('sequence'));
        const imported = IsActorImported(ActorIndexForSetting);

        const isSetting = $('#actor_switcher').hasClass('setting');
        if($(this).hasClass('unlink') && !isSetting){
            if(imported){
                $('#actor_setting_make_thumbnail').removeClass('events_disable');
                $('#actor_setting_force_medialink').removeClass('events_disable');
                $('#actor_setting_remove_actor').addClass('events_disable');
            } else {
                $('#actor_setting_make_thumbnail').addClass('events_disable');
                $('#actor_setting_force_medialink').addClass('events_disable');
                $('#actor_setting_remove_actor').removeClass('events_disable');
            }
            $('#actor_setting_delete_thumbnail').removeClass('events_disable');
            $('#actor_setting_delink').addClass('events_disable');
            $('#actor_setting_convert_lightweight').addClass('events_disable');
        } else {
            $('#actor_setting_make_thumbnail').addClass('events_disable');
            $('#actor_setting_delete_thumbnail').addClass('events_disable');
            $('#actor_setting_force_medialink').addClass('events_disable');
            $('#actor_setting_remove_actor').addClass('events_disable');
            
            if(isSetting){
                $('#actor_setting_convert_lightweight').addClass('events_disable');
                $('#actor_setting_delink').addClass('events_disable');
            } else {
                $('#actor_setting_convert_lightweight').removeClass('events_disable');
                $('#actor_setting_delink').removeClass('events_disable');
            }
        }
    });
    $(document).on('contextmenu', '.actor_thumb_parent, .actor_clipset', function (e) {
        contextmenus.removeClass('contextmenu_show');
        let parts_contextmenu = $('#parts_contextmenu');
        parts_contextmenu.css('left', e.pageX-window.scrollX + 'px');
        parts_contextmenu.css('top', e.pageY-window.scrollY + 'px');
        if($('#actor_switcher').hasClass('setting') && $(this).closest('#actor_switcher').length > 0) {
            parts_contextmenu.addClass('contextmenu_show');
            ContextmenuPartsSelectJQElm = $(this);
        }
        return false;
    });
    $(document).on('contextmenu', '.actor_parts_top', function (e) {
        contextmenus.removeClass('contextmenu_show');
        if($('#actor_switcher').hasClass('setting')){
        let group_contextmenu = $('#group_contextmenu');
        group_contextmenu.css('left', e.pageX-window.scrollX + 'px');
        group_contextmenu.css('top', e.pageY-window.scrollY + 'px');
            if($(this).closest('#actor_switcher').length > 0 && $(this).hasClass('dragitem')) {
            group_contextmenu.addClass('contextmenu_show');
            ContextmenuGroupSelectJQElm = $(this);
            if(ContextmenuGroupSelectJQElm.siblings('.actor_parts_top').length === 0) {
                $('#actor_setting_remove_group_button').addClass('events_disable');
            } else {
                $('#actor_setting_remove_group_button').removeClass('events_disable');
            }
        }
        } else {
            let group_contextmenu = $('#bake_contextmenu');
            group_contextmenu.css('left', e.pageX-window.scrollX + 'px');
            group_contextmenu.css('top', e.pageY-window.scrollY + 'px');
            if($(this).closest('#actor_switcher').length > 0) {
                group_contextmenu.addClass('contextmenu_show');
                ContextmenuGroupSelectJQElm = $(this);
                if(ContextmenuGroupSelectJQElm.attr('has_anim') !== undefined) {
                    $('#actor_bake_animation').removeClass('events_disable');
                } else {
                    $('#actor_bake_animation').addClass('events_disable');
                }
            }
        }
    });
    $('#actor_setting_start_button').on('mouseup', function(e) {
        if(e.which === 1) {
            if(IsActorImported(ActorIndexForSetting)){
                StartActorSetting();
            } else {
                const actorName = GetActorName(ActorIndexForSetting);
                ImportActor(actorName, ActorIndexForSetting, StartActorSetting);
            }
        }
    });

    $('#actor_setting_make_thumbnail').on('mouseup', function(e) {
        if(e.which === 1) {
            ThumbnailGenerator(ActorIndexForSetting, false, true);
        }
    });
    $('#actor_setting_delete_thumbnail').on('mouseup', function(e) {
        if(e.which === 1) {
            const target = $(".actor_sequence_link[sequence='" + ActorIndexForSetting + "']");
            const actorNameElm = target.children('.actor_sequence_link_label');
            const actorName = actorNameElm.html();
            const imported = actorNameElm.attr('imported');
            let script = makeEvalScript('GetActorStructureMediaPath', actorName);
            csInterface.evalScript(script, function(actorStructPath) {
                if(actorStructPath !== '' || !imported) {
                    if(!imported){
                        actorStructPath = GetActorSettingPath(actorName);
                    }
                    if(!LoadActorStructure(actorStructPath, ActorIndexForSetting)) return;
                    const conf = UIkit.modal.confirm('この変更は取り消せません。削除しますか？', {labels: {cancel: 'サムネイルを削除する', ok: 'キャンセル'}, bgClose:true});
                    setWarningToUikitConfirmButton($(conf.dialog.$el), 0);
                    if(!OSIsWin) swapUikitConfirmButton($(conf.dialog.$el));
                    conf.then(function() {}, function(){
                        const actorStructure = ActorStructure[ActorIndexForSetting];
                        if(actorStructure){
                            const _deleteFunc = function(){
                                const saveCropPathList = actorStructure[ACT_ST_crop_path];
                                let count = 0;
                                const cropDirPath = actorStructure[ACT_ST_crop_dir_path];
                                for(key in saveCropPathList){
                                    const cropPath = cropDirPath + saveCropPathList[key].path;
                                    if(fs.existsSync(cropPath)){
                                        window.cep.fs.deleteFile(cropPath);
                                        count++;
                                    }
                                }
                                const script = makeEvalScript('MessageInfo', count.toString() + '個のサムネイルを削除しました');
                                csInterface.evalScript(script);
                            }
                            if(actorStructure[ACT_ST_lightweight] && IsActorImported(ActorIndexForSetting)){
                                const conf2 = UIkit.modal.confirm('立ち絵の軽量化を使用中です。削除するためには軽量化を解除する必要があります。', {labels: {cancel: '軽量化を解除してサムネイルを削除する', ok: 'キャンセル'}, bgClose:true});
                                setWarningToUikitConfirmButton($(conf2.dialog.$el), 0);
                                if(!OSIsWin) swapUikitConfirmButton($(conf2.dialog.$el));
                                conf2.then(function() {}, function(){
                                    UpdateMediaPathActorIndex = ActorIndexForSetting;
                                    actorStructure[ACT_ST_lightweight] = 0;
                                    SaveJson(ActorStructure[ActorIndexForSetting], ActorStructurePath[ActorIndexForSetting]);
                                    UpdateMediaPath(function(result){
                                        if(result) {
                                            _deleteFunc();
                                        }
                                    });
                                });
                            } else {
                                _deleteFunc();
                            }
                        }
                    });
                } else {
                    alert("構成ファイルが見つかりません。立ち絵設定を行ってください");
                    StartActorSetting();
                }
            });
        }
    });
    $('#actor_setting_delink').on('mouseup', function(e) {
        if(e.which === 1) {
            const target = $(".actor_sequence_link[sequence='" + ActorIndexForSetting + "']");
            actorDelink(target);
        }
    });
    $('#actor_setting_convert_lightweight').on('mouseup', function(e) {
        if(e.which === 1) {
            const target = $(".actor_sequence_link[sequence='" + ActorIndexForSetting + "']");
            const actorName = target.children('.actor_sequence_link_label').html();
            const lightweight = ActorStructure[ActorIndexForSetting][ACT_ST_lightweight];
            const actor_bbox = ActorStructure[ActorIndexForSetting][ACT_ST_actor_bbox];
            const crop_list = ActorStructure[ActorIndexForSetting][ACT_ST_crop_path];
            const tree_path_list = [];
            const bbox_list = [];
            BusyNotificationOpen('シーケンスの変換中');
            if(lightweight){
                for(key in crop_list){
                    tree_path_list.push(key);
                    bbox_list.push(crop_list[key].bbox.join(','));
                }
                const script = makeEvalScript('ConvertLightweightSequence', actorName, ActorIndexForSetting, tree_path_list.join('\\n'), bbox_list.join('\\n'), actor_bbox[0], actor_bbox[1], 1);
                csInterface.evalScript(script, BusyNotificationClose);
            }else{
                const image = new Image();
                image.onload = function(){
                    const width = image.width;
                    const height = image.height;
                    const bbox = [0, 0, width, height].join(',');
                    for(key in crop_list){
                        tree_path_list.push(key);
                        bbox_list.push(bbox);
                    }
                    const script = makeEvalScript('ConvertLightweightSequence', actorName, ActorIndexForSetting, tree_path_list.join('\\n'), bbox_list.join('\\n'), actor_bbox[0], actor_bbox[1], 0);
                    csInterface.evalScript(script, BusyNotificationClose);
                };

                let src_path = '';
                for(key in crop_list){
                    src_path = ActorStructure[ActorIndexForSetting][ACT_ST_src_dir_path] + crop_list[key].src;
                    break;
                }
                image.src = src_path;
            }
        }
    });
    $('#actor_setting_remove_parts_button').on('mouseup', function(e) {
        if(e.which === 1) {
            DeleteSelectedParts();
        }
    });
    $('#actor_setting_remove_actor').on('mouseup', function(e) {
        if(e.which === 1) {
            RemoveActorSettingPath(GetActorName(ActorIndexForSetting));
            $(`.actor_sequence_link[sequence=${ActorIndexForSetting}]`).remove();
        }
    });
    $('#actor_setting_add_group_button').on('mouseup', function(e) {
        if(e.which === 1 && ContextmenuGroupSelectJQElm) {
            const group = MakeGroupElement('New group', 0, [], '', null, CLIP_TYPE_None, '', true);
            SortableCreateActor(group.find('.actor_group')[0], true, OnAddAnimationSetting);
            ActorPartsToSetting(group);
            ContextmenuGroupSelectJQElm.before(group);
        }
    });
    $('#actor_setting_remove_group_button').on('mouseup', function(e) {
        if(e.which === 1 && ContextmenuGroupSelectJQElm) {
            ContextmenuGroupSelectJQElm.remove();
        }
    });
    $('#actor_setting_add_animation_clip_on_group').on('mouseup', function(e) {
        if(e.which === 1 && ContextmenuGroupSelectJQElm) {
            // #AnimationEditStart
            IsAnimationEditing = true;
            AnimationEditingGroupJQElm = ContextmenuGroupSelectJQElm;
            AnimationEditingGroupJQElm.siblings().attr('hidden', '');
            const clips = AnimationEditingGroupJQElm.find('.dragitem');
            clips.removeClass('dragitem');
            clips.filter('[data-type!=' + CLIP_TYPE_Animation + ']').attr('hidden', '');
            const type = AnimationEditingGroupJQElm.attr('anim-type') ? AnimationEditingGroupJQElm.attr('anim-type') : 0;
            const select_animation_type = $('#select_animation_type'); 
            select_animation_type.val(type);
            select_animation_type.change();

            const firstAnimClip = clips.filter('[data-type=' + CLIP_TYPE_Animation + ']:first');
            if(firstAnimClip.length > 0) {
                $('#animation_editor_help1').attr('hidden', '');
                firstAnimClip.trigger('click');
            } else {
                $('#animation_editor_help1').removeAttr('hidden');
                $('#animation_editor_root').addClass('events_disable');
            }

            AnimationEditingGroupJQElm.removeClass('dragitem');
            AnimationEditingGroupJQElm.find('.td-thumbnav').addClass('dragdrop-area-bg');
            $('#actor_setting_add_animation_clip_button').removeAttr('hidden');
            $('#animation_editor_root').removeAttr('hidden');
            $('#animation_type_root').removeAttr('hidden');
            $('#actor_setting_save_button').attr('hidden','');
            $('#actor_setting_cancel_button').attr('hidden','');
            $('#actor_setting_animation_end_button').removeAttr('hidden');
        }
    });

    $('#actor_setting_add_animation_clip_button').on('mouseup', function(e) {
        const li = $('<li>', {'class':'actor_thumb_parent', name:"", group_index: 0, 'data-type':CLIP_TYPE_Animation});
        const img = $('<img>', {'class':'actor_thumb thumb_background fix_size_img', src:'', hidden:''});
        li.append(img);
        li.append($('<span>', {'uk-icon':'icon: image; ratio:2'}));
        AnimationEditingGroupJQElm.find('ul').append(li);
    });

    $('#actor_bake_animation').on('mouseup', function(e) {
        const seq_index = $('.actor_linknav > ul > .enable').attr('sequence');
        const group_index = ContextmenuGroupSelectJQElm.attr('group_index');
        const anim_type = ContextmenuGroupSelectJQElm.attr('anim-type');
        const source = Number(ContextmenuGroupSelectJQElm.find('.input_source_track').val()) - 1;
        let script = '';
        
        const progress = ContextmenuGroupSelectJQElm.find('.td_bake_progress');
        progress.children('progress').val(0);
        progress.children('div').html('');
        progress.removeAttr('hidden');
        progress.siblings().addClass('events_disable');
        const id = 'p' + seq_index + group_index;
        bakeProgressBarElms[id] = progress;
        if(anim_type == 0){
            script = makeEvalScript('FrameAnimation_Random', seq_index, group_index, id);
        } else if(anim_type == 1){
            script = makeEvalScript('FrameAnimation_Audio', seq_index, group_index, source, '', id);
        }
        csInterface.evalScript(script);
    });

    document.body.addEventListener('click', function () {
        contextmenus.removeClass('contextmenu_show');
        ContextmenuPartsSelectJQElm = null;
        ContextmenuGroupSelectJQElm = null;
    });

    $('#animation_editor_thumbnav')[0].addEventListener('mousewheel', HorizontalScroll, { passive: false });
    SortableCreateActor($('#animation_editor_thumbnav>ul')[0], true, function(evt) {
        const jqElm = $(evt.item);
        jqElm.filter(':not(:has(input))').append($('<input>', { class: 'input_integer_only uk-light tdinput', type: 'text', placeholder: 'f(60fps)', style: 'display: block; width:56px', onfocus: 'this.select();' }));
        jqElm.siblings(':not(:has(input))').append($('<input>', { class: 'input_integer_only uk-light tdinput', type: 'text', placeholder: 'f(60fps)', style: 'display: block; width:56px', onfocus: 'this.select();' }));
        $('#animation_editor_help1').attr('hidden', '');
    });
    SortableCreateActor($('#animation_editor_thumbnail>ul')[0], 'clone', function(evt) {
        const jqElm = $(evt.item);
        jqElm.siblings().remove();
        jqElm.find('input').remove();
        const selectItem = AnimationEditingGroupJQElm.find('.anim_selected');
        selectItem.attr('tree_path', jqElm.attr('tree_path'));
        selectItem.find('img').attr('src', jqElm.find('img').attr('src'));
    });

    $('#animation_play_button').on('click', function(e){
        const enable = enableSwitch($(this));
        if(enable) {
            AnimationPreview_SourceChange(true, false);
        } else {
            AnimationPreview_Stop();
        }
    });

    $('#animation_view_reset').on('click', function(e){
        AnimationPreviewReset();
    });


    $('#animation_editor_name').change(function() {
        $('.anim_selected').attr('name', $(this).val());
    });

    $('#select_animation_type').change(function() {
        const type = $(this).val();
        const elements_type0 = $('.animation_type0_elm');
        const help2 = $('#animation_editor_help2');
        const help3 = $('#animation_editor_help3');
        if(type == 0){
            elements_type0.removeAttr('hidden');
            help2.html('通常');
            help3.html('動作時');
        } else if(type == 1){
            elements_type0.attr('hidden', '');
            help2.html('閉じ');
            help3.html('開き');
        }
    });

    $(document).on('click', '.actor_gruop_expand_button', function() {
        const child = $(this).children();
        child.toggleClass('expanded');
        $(this).closest('.insert_mode').toggleClass('expanded');
    });

    $(document).on('keydown', '.input_auto_resize', function() {
        this.style.width = ((this.value.length + 2) * 8) + "px";
    });
    $(document).on('change', '.input_auto_resize', function() {
        this.style.width = ((this.value.length + 1) * 8) + "px";
    });
    $(document).on('change', '.input_source_track', function() {
        if(this.value.length > 0){
            $(this).addClass('filled');
        } else {
            $(this).removeClass('filled');
        }
        const seqIndex = $(this).closest('.actor_component').attr('sequence');
        const groupIndex = $(this).closest('.actor_parts_top').attr('group_index');
        const idx = ActorStructure[seqIndex].actor.length - groupIndex - 1;
        if(ActorStructure[seqIndex].actor[idx].source != this.value){
            ActorStructure[seqIndex].actor[idx].source = this.value;
            SaveJson(ActorStructure[seqIndex], ActorStructurePath[seqIndex]);
        }
    });

    csInterface.addEventListener('incrementalBakeNotification', function(e) {
        const data = e.data.split(',');
        const actor_root = $('.actor_component[sequence="' + data[0] + '"]');
        const group = actor_root.find('.actor_parts_top[group_index=' + data[1] + ']');
        const button = group.find('[name="incremental_bake"]');
        if(data[2] === '0'){
            setDisable(button);
        } else {
            setEnable(button);
        }
    });

    csInterface.addEventListener('bakeTextNotification', function(e){
        const data = e.data.split(',');
        const id = data[0];
        const text = data[1];
        if(bakeProgressBarElms[id]){
            bakeProgressBarElms[id].children('div').html(text);
        }
    });
    csInterface.addEventListener('bakeMaxNotification', function(e){
        const data = e.data.split(',');
        const id = data[0];
        const max = data[1];
        if(bakeProgressBarElms[id]){
            bakeProgressBarElms[id].children('progress').attr('max', max);
        }
    });
    csInterface.addEventListener('bakeValueNotification', function(e){
        const data = e.data.split(',');
        const id = data[0];
        const value = data[1];
        if(bakeProgressBarElms[id]){
            bakeProgressBarElms[id].children('progress').attr('value', value);
        }
    });
    csInterface.addEventListener('bakeCompleteNotification', function(e){
        const id = e.data;
        if(bakeProgressBarElms[id]){
            bakeProgressBarElms[id].attr('hidden', '');
            bakeProgressBarElms[id].siblings().removeClass('events_disable');

        }
        delete bakeProgressBarElms[id];
    });
    csInterface.addEventListener('progressValueNotification', function(e){
        const data = e.data.split(',');
        const id = data[0];
        const value = data[1];
        $(id).attr('value', value);
    });
    csInterface.addEventListener('progressMaxNotification', function(e){
        const data = e.data.split(',');
        const id = data[0];
        const value = data[1];
        $(id).attr('max', value);
    });
    csInterface.addEventListener('framerateMismatchMessage', function(e){
        const index = e.data;
        const parentElm = $(`.actor_sequence_link[sequence=${index}]`);
        if(!parentElm.find('.actor_sequence_warning_icon')[0]){
            parentElm.attr('uk-tooltip', 'メイン・キャラクター・アニメーションのシーケンスでフレームレートが一致していません。（設定変更後、再度キャラクター名をクリックするとこの表示は消えます）')
            const icon = $(`.actor_sequence_link[sequence=${index}]`).find('.actor_sequence_link_icon');
            const div_icon = $('<div>', {'class':'actor_sequence_warning_icon', 'uk-icon':'warning'});
            icon.after(div_icon);
        }
    });
    csInterface.addEventListener('framerateMatchMessage', function(e){
        const index = e.data;
        const parentElm = $(`.actor_sequence_link[sequence=${index}]`);
        parentElm.removeAttr('uk-tooltip');
        const icon = parentElm.find('.actor_sequence_warning_icon');
        icon.remove();
    });
}

function DeleteSelectedParts() {
    if(ContextmenuPartsSelectJQElm) {
        ContextmenuPartsSelectJQElm.remove();
        ContextmenuPartsSelectJQElm = null;
    }
    $('.selected').remove();
}