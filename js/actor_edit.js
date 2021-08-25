
const ACT_ST_actor = 'actor';
const ACT_ST_crop_path = 'crop_path';
const ACT_ST_clipset = 'clipset';
const ACT_ST_version = 'version';
const CLIP_TYPE_None = 'none';
const CLIP_TYPE_Animation = 'Anim';

let ActorIndexForSetting = -1;
let ContextmenuPartsSelectJQElm = null;
let ContextmenuGroupSelectJQElm = null;
let AnimationEditingGroupJQElm = null;
let ActorStructure = [];
let ActorStructurePath = [];
let IsAnimationEditing = false;
let AnimationIndexes = [];

$(document).on('click', '.actor_sequence_link.unlink', function() {
    if($('#actor_switcher').hasClass('setting')) return;
    var index = $(this).attr('sequence');
    var actorName = $(this).children('.actor_sequence_link_label').html();
    var actor_sequence_link = $(this);
    var actor_sequence_link_icon = $(this).find('.actor_sequence_link_icon');
    $('.actor_sequence_link').removeClass('enable');
    $('#actor_switcher').find('li').removeClass('uk-active');
    var target_actor_component = $('#actor_switcher').find("[sequence='" + index + "']");
    var actor_root = $('.actor_component[sequence="' + index + '"]');
    
    csInterface.evalScript('$._PPP_.GetActorStructureMediaPath("' + actorName + '")', function(actorStructPath) {
        if(actorStructPath === '') {
            alert("構成ファイルが見つかりません。立ち絵設定を行ってください");

            ActorIndexForSetting = index;
            StartActorSetting();
        } else {
            ActorStructure[index] = LoadActorStructure(actorStructPath);
            ActorStructurePath[index] = actorStructPath;
            csInterface.evalScript('$._PPP_.SetLinkSequence("' + index + '")', function(result) {
                if(result === '0') {
                    actor_sequence_link.addClass('enable');
                    actor_sequence_link.removeClass('unlink');
                    actor_sequence_link.addClass('linked');
                    actor_sequence_link_icon.attr('uk-icon', 'link');
                    target_actor_component.addClass('uk-active');
                    actor_root.empty();

                    SetupActorComponent(index, actorName);
                } else {
                    var errormsg = 'Error : ';
                    switch(result){
                        case '1':
                            errormsg += 'アクティブシーケンスがありません';
                            break;
                        case '2':
                            errormsg += 'クリップが選択されていません';
                            break;
                        case '3':
                            errormsg += '複数のクリップを選択してます';
                            break;
                        case '4':
                            errormsg += 'シーケンスが選択されていません';
                            break;
                        default:
                            errormsg += 'Unknown';
                            break;
                    }
                    if(result !== '2') {
                        alert(errormsg);
                    } else {
                        if(!confirm(errormsg + '\nシーケンスを作成しますか？')){
                            return false;
                        } else {
                            let treePath = '';
                            for(let i = 0; i < ActorStructure[index].actor.length; i++) {
                                let clips = ActorStructure[index].actor[i].clips;
                                for(let j = 0; j < clips.length; j++){
                                    treePath = clips[j].tree_path;
                                    i = ActorStructure[index].actor.length;
                                    break;
                                }
                            }
                            csInterface.evalScript('$._PPP_.CreateActorSequence("' + actorName + '","' + treePath + '")');
                        }
                    }
                }
            });
        }
    });
});

$(document).on('click', '.actor_sequence_link.linked', function(e){
    if(e.shiftKey) {
        if(!confirm('シーケンスとのリンクを解除します')){
            return false;
        } else {
            var index = $(this).attr('sequence');
            var actor_root = $('.actor_component[sequence="' + index + '"]');
            actor_root.empty();
            $('.actor_sequence_link').removeClass('enable');
            $(this).removeClass('linked');
            $(this).addClass('unlink');
            $(this).find('.actor_sequence_link_icon').attr('uk-icon', 'ban');;
            $('#actor_switcher').find('li').removeClass('uk-active');
        }
    } else {
        $('.actor_sequence_link').removeClass('enable');
        $(this).addClass('enable');
        $('#actor_switcher').find('li').removeClass('uk-active');
        $('#actor_switcher').find('li[sequence="' + $(this).attr('sequence') + '"]').addClass('uk-active');
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
        const nameList = names.split(',');
        for(let i = 0; i < nameList.length; i++) {
            const act_switch = $('<li>', {'class':'', sequence:i});
            const actor_component = $('<div>', {'class':'actor_component', sequence:i});
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
            act_switch.append(actor_component);
            actor_switcher.append(act_switch);

            const li = $('<li>', {'class': 'actor_sequence_link uk-animation-fade uk-width-auto unlink', sequence : i});
            const div_icon = $('<div>', {'class':'actor_sequence_link_icon', 'uk-icon':'ban'});
            const div_label = $('<div>', {'class':'actor_sequence_link_label'});
                div_label.html(nameList[i]);
            li.append(div_icon);
            li.append(div_label);
            actor_linknav.append(li);
        }
    });
}

function actorSettingStart(actorName, index, force_initialize) {
    const actorObj = ActorStructure[index];
    csInterface.evalScript('$._PPP_.GetActorStructure("'+ actorName + '")', function(struct) {
        if(struct) {
            const elmNum = 4;
            const structList = struct.split(',');
            const length = structList.length / elmNum;
            let prevGroupName = ""
            let prevGroup = null;
            for(let i = 0; i < length; i++) {
                let currentGroupName = structList[i * elmNum + 1];
                if(currentGroupName !== prevGroupName){
                    prevGroup = AddPartsBoxGroup(currentGroupName);
                    prevGroupName = currentGroupName;
                }
                AddActorClip(prevGroup, structList[i * elmNum], structList[i * elmNum + 3], actorObj.crop_path[structList[i * elmNum + 3]]);
            }
        } else {

        }
    });
}

function setActorClipSet(shortcutKey) {
    const linkdActor = $('.actor_sequence_link');
    for(let i = 0; i < linkdActor.length; i++) {
        if(linkdActor.eq(i).hasClass('enable')) {
            const seqIndex = linkdActor.eq(i).attr('sequence');
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

                csInterface.evalScript('$._PPP_.GetActorStructureMediaPath("' + actorName + '")', function(result) {
                    const mediaPathList = result.split(',');
                    if(result !== '' && mediaPathList.length == 1) {
                        const err = SaveJson(ActorStructure[seqIndex], mediaPathList[0]);
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
    csInterface.evalScript('$._PPP_.InsertActorClip("' + actor_name + '",' + seq_index + ','+ group_index + ',"' + tree_path + '",-1,' + flag + ')');	
}

function insertAnimationMarker(seq_index, group_index, comment, flag, type, sourceIndex) {
    const script = makeEvalScript('InsertFrameAnimationMarker', seq_index, group_index, comment, flag, type, sourceIndex);
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
    const div = $('<div>', {style:'text-align: right'});
    details.append(div);
    $('#actor_parts_box').append(details);
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
    return div;
}

function AddActorClip(rootNode, name, tree_path, crop_path) {
    const li = $('<li>', {'class':'actor_thumb_parent dragitem', name:name, tree_path:tree_path, group_index: 0, 'uk-flex':'', 'uk-flex-column':'', 'data-type':CLIP_TYPE_None, 
     'uk-tooltip': 'pos:top-right; duration:0; title:<img class="actor_tooltip thumb_background" src="' + crop_path + '"><div>' + name +'</div>'});

    const img = $('<img>', {'class':'thumb_background fix_size_img'});
    const crop = crop_path;
    if (crop && fs.existsSync(crop)) {
        img.attr('src', crop);
        li.append(img);
    } else {
        li.append($('<span>', {'uk-icon':'icon: question; ratio:2'}));
    }
    rootNode.append(li);
}

function InitializeActorStructure() {
    if(!confirm('設定を初期化しますか？')){
        return false;
    } else {

    }
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

function MakeGroupElement(group_name, group_index, clips, crop_path_list, anim_type, anim_source, isSetting) {
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
    const incrementalBakeDiv = $('<div>', {'class':'td-icon-button hidden_at_setting', name:'incremental_bake', 'uk-icon':'icon:bolt; ratio:0.8', style:'height:21px; margin:0 0 0 5px; padding:0 5px 0 5px;'});
    incrementalBakeDiv.on('click', function(e){
        const target = $(this);
        const status = enableSwitch(target);
        const seq_index = $('.actor_linknav > ul > .enable').attr('sequence');
        const group_index = target.closest('.actor_parts_top').attr('group_index');
        const source = Number(target.siblings('.input_source_track').val()) - 1;
        const enable = status ? 1 : 0;
        const script = makeEvalScript('SetIncrementalBakeFlag', seq_index, group_index, source, enable);
        csInterface.evalScript(script);
    });
    animLabel.append(incrementalBakeDiv);
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
    
    const checkbox_div = $('<div>', {'class':'uk-width-auto uk-height-expand insert_mode', style:'padding-left:40px'});
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
        const crop = crop_path_list[clips[j].tree_path];
        if (crop && fs.existsSync(crop)) {
            img.attr('src', crop);
            li.append(img);
        } else {
            li.append($('<span>', {'uk-icon':'icon: question; ratio:2'}));
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

        for(let i = 0; i < actorObj.actor.length; i++) {
            const group_index = actorObj.actor.length - 1 - i;
            const actor = MakeGroupElement(
                actorObj.actor[i].group, 
                group_index, 
                actorObj.actor[i].clips, 
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

                if(treePathList.length > 0) {
                    treePathList = Array.from(new Set(treePathList));
                    const script = makeEvalScript('SetupAnimationMarker', actorName, actorObj.actor[i].group, index, group_index, treePathList.join(','));
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

function LoadActorStructure(path) {
    const json = window.cep.fs.readFile(path);
    if(json.err){
        if(json.err == window.cep.fs.ERR_NOT_FOUND) {
            alert('"' + path + '"が見つかりません。');
            return null;
        } else {
            alert("err : " + json.err);
        }
    }
    return ActorStructureVersionConvert(JSON.parse(json.data));
}

let cropImageCounter = 0;
let cropImageSize = 0;


function cropImageCallback(){
    cropImageCounter += 1;
    if(cropImageCounter === cropImageSize){
        $('#mainfunc').removeClass('disable');
        $('#busy_notification').removeClass('uk-open');
        $('#busy_notification').attr('style', '');
    }
}

const Jimp = require('jimp');
const autocrop = require('autocropmodule/autocropmodule.js');

function save_transparent_crop(src_path, dist_path, callback) {
    Jimp.read(src_path, (err, image) => {
        if (!err) {
            image.autocrop = autocrop;
            image.autocrop(5);
            image.write(dist_path);
            if(callback) callback();
        }
    });
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
            } else {
                $('.selected').not(this).removeClass('selected');
                target.addClass('selected');
            }
        }
    }
});

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

function StartActorSetting() {
    const actor_sequence_link = $('.actor_sequence_link');
    const target = $(".actor_sequence_link[sequence='" + ActorIndexForSetting + "']");
    const actorName = target.children('.actor_sequence_link_label').html();
    csInterface.evalScript('$._PPP_.GetActorStructureMediaPath("' + actorName + '")', function(actorStructPath) {
        const _startActorSetting = function(path) {
            ActorStructure[ActorIndexForSetting] = LoadActorStructure(path);
            ActorStructurePath[ActorIndexForSetting] = path;

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
        
        if(actorStructPath === '') {
            csInterface.evalScript('$._PPP_.GetActorStructure("'+ actorName + '")', function(struct) {
                if(struct) {
                    let new_actor_structure = {};
                    const elmNum = 4;
                    const structList = struct.split(',');
                    const length = structList.length / elmNum;
                    let prevGroupName = ""
                    let actor = [];
                    let group_obj = {};
                    let saveCropPathList = {};
                    const crop_list = [];
                    
                    save_structure_file_path = window.cep.fs.showSaveDialogEx('構成ファイルの保存先', '', ['txt'], actorName + '.txt').data;
                    if(!save_structure_file_path) return;

                    let crop_dir = window.cep.fs.showOpenDialogEx(false, true, 'サムネイルの保存先', null).data;
                    if(crop_dir == '') return;
                    crop_dir += '/';

                    for(let i = 0; i < length; i++) {
                        let currentGroupName = structList[i * elmNum + 1];
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
                            clip: structList[i * elmNum],
                            tree_path: structList[i * elmNum + 3]
                        };
                        group_obj.clips.push(clip_obj);
                        let src_path = structList[i * elmNum + 2];
                        let lastIndex = src_path.lastIndexOf(".");
                        let crop_path = crop_dir + structList[i * elmNum] + GetUUID() + src_path.substr(lastIndex);
                        crop_list.push({src:src_path, dst:crop_path});
                        saveCropPathList[structList[i * elmNum + 3]] = crop_path;
                    }
                    if(Object.keys(group_obj).length > 0) {
                        actor.push(group_obj);
                    }

                    new_actor_structure[ACT_ST_actor] = actor;
                    new_actor_structure[ACT_ST_crop_path] = saveCropPathList;
                    new_actor_structure[ACT_ST_version] = 1;

                    // クロップイメージの作成
                    cropImageCounter = 0;
                    cropImageSize = crop_list.length;
                    if(cropImageSize > 0) {
                        $('#mainfunc').addClass('disable');
                        $('#busy_notification').addClass('uk-open');
                        $('#busy_notification').attr('style', 'display: block;');
                        for(let i = 0; i < cropImageSize; i++) {
                            save_transparent_crop(crop_list[i].src, crop_list[i].dst, cropImageCallback);
                        }
                    }
                    SaveJson(new_actor_structure, save_structure_file_path);
                    csInterface.evalScript('$._PPP_.ImportActorStructureFile("' + save_structure_file_path.replace(/\\/g, '/') + '","'+ actorName + '")', function(result) {
                        if(!result) {
                            alert('構成ファイルのインポートに失敗しました');
                            return; // TODO キャンセル
                        }
                        _startActorSetting(save_structure_file_path)
                    });
                }
            });   
        } else {
            _startActorSetting(actorStructPath)
        }
    });
}

function SortableCreateActor(groupElm, pullAction=true, onAddFunc=null){
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
        actor_root.find('.actor_clipset').each(function(){
            new_clip_set[$(this).html()] = current_clip_set[$(this).html()];
        });
        new_actor_structure[ACT_ST_clipset] = new_clip_set;
    }
    new_actor_structure[ACT_ST_crop_path] = current_actor_structure[ACT_ST_crop_path];
    new_actor_structure[ACT_ST_version] = current_actor_structure[ACT_ST_version];

    SaveJson(new_actor_structure, ActorStructurePath[ActorIndexForSetting]);
    ActorStructure[ActorIndexForSetting] = new_actor_structure;
    UpdateGroupIndex();
    ActorSettingEnd();
}

function ActorSettingEnd(){
    $('#actor_parts_box').attr('hidden', '');
    $('#actor_setting_save_button').attr('hidden', '');
    $('#actor_setting_cancel_button').attr('hidden', '');
    $('#actor_setting_start_button').removeClass('events_disable');
    $('.hidden_at_setting').removeAttr('hidden');
    $('.dragitem').removeClass('.dragitem');
    $('#actor_switcher').removeClass('setting');
    $('#actor_parts_box').html('');

    const target = $(".actor_sequence_link[sequence='" + ActorIndexForSetting + "']");
    let actor_sequence_link_icon = target.find('.actor_sequence_link_icon');
    const actor_root = $('.actor_component[sequence="' + ActorIndexForSetting + '"]');
    actor_root.empty();
    if(target.hasClass('unlink')) {
        actor_sequence_link_icon.attr('uk-icon', 'ban');
        target.removeClass('enable');
    } else {
        actor_sequence_link_icon.attr('uk-icon', 'link');
        var actorName = target.children('.actor_sequence_link_label').html();
        SetupActorComponent(ActorIndexForSetting, actorName);
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
    const type = $('#select_animation_type').val();
    AnimationEditingGroupJQElm.attr('anim-type', type);

    const prevClip = AnimationEditingGroupJQElm.find('.anim_selected');
    if(prevClip.length > 0) {
        SaveAnimationEdit(prevClip);
    }

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

function ActorStructureVersionConvert(actor_structure) {
    if(!actor_structure.version) {
        actor_structure = ActorStructureVersionConvert1(actor_structure);
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
    delete version1.actor[version1.actor.length - 1];
    version1[ACT_ST_crop_path] = crop_path;
    version1[ACT_ST_version] = 1;
    return version1;
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

function ActorEditInitialize() {
    let contextmenus = $('.contextmenu');
    $(document).on('contextmenu', '.actor_sequence_link', function (e) {
        contextmenus.removeClass('contextmenu_show');
        let actor_contextmenu = $('#actor_contextmenu');
        actor_contextmenu.css('left', e.pageX-window.scrollX + 'px');
        actor_contextmenu.css('top', e.pageY-window.scrollY + 'px');
        actor_contextmenu.addClass('contextmenu_show');
        ActorIndexForSetting = Number($(this).attr('sequence'));
    });
    const anim_clip = $('#actor_setting_add_animation_clip');
    $(document).on('contextmenu', '.actor_thumb_parent, .actor_clipset', function (e) {
        contextmenus.removeClass('contextmenu_show');
        let parts_contextmenu = $('#parts_contextmenu');
        parts_contextmenu.css('left', e.pageX-window.scrollX + 'px');
        parts_contextmenu.css('top', e.pageY-window.scrollY + 'px');
        if($('#actor_switcher').hasClass('setting') && $(this).closest('#actor_switcher').length > 0) {
            if($(this).hasClass('actor_clipset')) {
                anim_clip.attr('hidden', '');
            } else {
                anim_clip.removeAttr('hidden');
            }
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

    $('#actor_setting_remove_parts_button').on('mouseup', function(e) {
        if(e.which === 1) {
            DeleteSelectedParts();
        }
    });
    $('#actor_setting_add_group_button').on('mouseup', function(e) {
        if(e.which === 1 && ContextmenuGroupSelectJQElm) {
            const group = MakeGroupElement('New group', 0, [], null, CLIP_TYPE_None, '', true);
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
    $('#actor_setting_add_animation_clip').on('mouseup', function(e) {
        if(e.which === 1) {
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
        if(anim_type == 0){
            script = makeEvalScript('FrameAnimation_Random', seq_index, group_index);
        } else if(anim_type == 1){
            script = makeEvalScript('FrameAnimation_Audio', seq_index, group_index, source);
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
        jqElm.siblings().remove()
        jqElm.find('input').remove();
        const selectItem = AnimationEditingGroupJQElm.find('.anim_selected');
        selectItem.attr('tree_path', jqElm.attr('tree_path'));
        selectItem.find('img').attr('src', jqElm.find('img').attr('src'));
    });

    // $('#animation_preview>div').on('click', function(e){
    //     const enable = enableSwitch($(this));
    //     if(enable) {
    //         AnimationPreviewInitialize();
    //     } else {
    //         if(previewTimeoutHandle != null) {
    //             clearTimeout(previewTimeoutHandle);
    //             previewTimeoutHandle = null;
    //         }
    //     }
    // });

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
        const seqIndex = $('.actor_sequence_link.enable').attr('sequence');
        const groupName = $(this).parent().siblings('.select_actor_group').html();
        for(let i = 0; i < ActorStructure[seqIndex].actor.length; i++){
            if(ActorStructure[seqIndex].actor[i].group == groupName){
                ActorStructure[seqIndex].actor[i].source = this.value;
            }
        }
        SaveJson(ActorStructure[seqIndex], ActorStructurePath[seqIndex]);
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

    // animationPreviewImgElm = $('#animation_preview_img');
    // animationPreviewThumbRootElm = $('#animation_editor_thumbnav');
}

function DeleteSelectedParts() {
    if(ContextmenuPartsSelectJQElm) {
        ContextmenuPartsSelectJQElm.remove();
        ContextmenuPartsSelectJQElm = null;
    }
    $('.selected').remove();
}