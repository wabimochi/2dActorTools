
const ACT_ST_actor = "actor";
const ACT_ST_crop_path = "crop_path";
const ACT_ST_clipset = "clipset";
const ACT_ST_version = "version";
let ActorIndexForSetting = -1;
let ContextmenuPartsSelectJQElm = null;
let ContextmenuGroupSelectJQElm = null;
let ActorStructure = [];
let ActorStructurePath = [];

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
            csInterface.evalScript('$._PPP_.SetLinkSequence("' + index + '")', function(result) {
                if(result === '0') {
                    actor_sequence_link.addClass('enable');
                    actor_sequence_link.removeClass('unlink');
                    actor_sequence_link.addClass('linked');
                    actor_sequence_link_icon.attr('uk-icon', 'link');
                    target_actor_component.addClass('uk-active');
                    actor_root.empty();

                    SetupActorComponent(index);
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
    const tree_path = $(this).attr('tree_path');
    const group_index = $(this).attr('group_index');
    const seq_index = $('.actor_linknav > ul > .enable').attr('sequence');
    const insert_mode = $(this).parents('.parts_selector');
    const flag = getClipEndFlag(insert_mode);
    insertActorClip(actorName, seq_index, group_index, tree_path, flag);
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
                    insertActorClip(actorName, seqIndex, j, treePathList[j], flag);
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
    const li = $('<li>', {'class':'actor_thumb_parent dragitem', name:name, tree_path:tree_path, group_index: 0, 'data-type':'none', 
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

function MakeThumbnav(){
    const thumbnav = $('<div>', {'class':'td-thumbnav uk-width-expand'});
    thumbnav[0].addEventListener('mousewheel', function(e) {
        const amount = 60;
        e.stopPropagation();
        var oEvent = e, 
            direction = oEvent.detail ? oEvent.detail * -amount : oEvent.wheelDelta, 
            position = $(this).scrollLeft();
        position += direction > 0 ? -amount : amount;
        $(this).scrollLeft(position);
        e.preventDefault();
    }, { passive: false });
    return thumbnav;
}

function MakeGroupElement(group_name, group_index, clips, crop_path_list) {
    const actor = $('<div>', {'class':'actor_parts_top'});

    const label = $('<div>', {style:'align-items: center; margin-left:0px;'});
    label.attr('uk-grid', '');

    const group = $('<div>', {'class':'uk-width-expand select_actor_group'});

    group.html(group_name);
    label.append($('<div>', {'class':'actor_group_tracktxt', text:'v' + (group_index + 1).toString()}));
    label.append(group);

    const partsName = $('<div>', {'class':'uk-width-auto uk-text-right select_actor_label'});
    label.append(partsName);

    actor.append(label);

    const partsSelector = $('<div>', {'class':'uk-text-center uk-padding uk-padding-small uk-padding-remove-vertical remove-top-margine parts_selector'});
    partsSelector.attr('uk-grid', '');
    
    const checkbox_div = $('<div>', {'class':'uk-width-auto uk-height-expand insert_mode'});
    checkbox_div.append($('<div>', {'uk-icon': 'unlock', 'class': 'uk-icon actor_insert_setting insert_setting_icon insert_disable'}));
    
    const inpointClipIcon = $('<div>', {'class': 'actor_insert_setting insert_setting_icon insert_inpoint enable'});
        inpointClipIcon.html(SVG_INPOINT_CLIP_ICON);
    const outpointClipIcon = $('<div>', {'class': 'actor_insert_setting insert_setting_icon insert_outpoint disable'});
        outpointClipIcon.html(SVG_OUTPOINT_CLIP_ICON);
    const markerIcon = $('<div>', {'class': 'actor_insert_setting insert_setting_icon insert_marker disable'});
        markerIcon.html(SVG_MARKER_ICON);
        
    checkbox_div.append(inpointClipIcon);
    checkbox_div.append(outpointClipIcon);
    checkbox_div.append(markerIcon);

    partsSelector.append(checkbox_div);

    const partsList = $('<div>', {'class':'uk-width-expand uk-flex uk-flex-left actor_parts_list'});
    const thumbnav = MakeThumbnav();


    const ul = $('<ul>', {'class':'uk-flex actor_group'});
    for(let j = 0; j < clips.length; j++){
        const li = $('<li>', {'class':'actor_thumb_parent', name:clips[j].clip, tree_path:clips[j].tree_path, group_index: group_index, 'data-type':'Anim'});
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
    const li = $('<li>', {'class':'actor_thumb_parent trash_icon', name:'このクリップを消す', tree_path:'delete', group_index: group_index, trash:'', 'data-type':'none'});
    const trash = $('<span>', {'uk-icon':'icon: trash; ratio:2'});
    li.append(trash);
    ul.append(li);

    thumbnav.append(ul);
    partsList.append(thumbnav);
    partsSelector.append(partsList);
    actor.append(partsSelector);
    return actor;
}

function SetupActorComponent(index){
    const actorObj = ActorStructure[index];
    if(actorObj) {
        actor_root = $('.actor_component[sequence="' + index + '"]');

        const thumbnav = MakeThumbnav();
        const ul = $('<ul>', {'class':'uk-flex actor_clipset_root'});
        const clipset = actorObj.clipset;
        for(shortcutKey in clipset){
            const li = $('<li>', {'class':'actor_clipset', text:shortcutKey.toString()});
            ul.append(li);
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
            const actor = MakeGroupElement(actorObj.actor[i].group, actorObj.actor.length - 1 - i, actorObj.actor[i].clips, actorObj.crop_path);
            actor_root.append(actor);
        }
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

$(document).on("click", ".actor_thumb_parent", function(e) {
    if(e.ctrlKey) {
    } else if(e.shiftKey) {
    } else {
        if($('#actor_switcher').hasClass('setting')){   
            $('.selected').not(this).removeClass('selected');
            $(this).addClass('selected');
        }
    }
});

function StartActorSetting() {
    const target = $(".actor_sequence_link[sequence='" + ActorIndexForSetting + "']");
    const actorName = target.children('.actor_sequence_link_label').html();
    csInterface.evalScript('$._PPP_.GetActorStructureMediaPath("' + actorName + '")', function(actorStructPath) {
        const _startActorSetting = function(path) {
            ActorStructure[ActorIndexForSetting] = LoadActorStructure(path);
            ActorStructurePath[ActorIndexForSetting] = path;

            $('#actor_parts_box').removeAttr('hidden');
            $('.actor_sequence_link').not("[sequence='" + ActorIndexForSetting + "']").attr('hidden', '');
            $('#actor_setting_save_button').removeAttr('hidden');
            $('#actor_setting_cancel_button').removeAttr('hidden');
            $('#actor_setting_start_button').addClass('events_disable');
            $('#actor_parts_box').removeAttr('hidden');
            $('#actor_switcher').find('[sequence]').removeClass('uk-active');
            $('#actor_switcher').find("[sequence='" + ActorIndexForSetting + "']").addClass('uk-active');
            if(target.hasClass('unlink')) {
                SetupActorComponent(ActorIndexForSetting);
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

function SortableCreateActor(groupElm){
    new Sortable.create(groupElm, {
        group: 'actor',
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
            $(evt.item).removeAttr('uk-tooltip');
            $(evt.item).siblings('[uk-tooltip]').removeAttr('uk-tooltip');
        }
    });
}

function ActorPartsToSetting(actor_parts_top_jqelm){
    actor_parts_top_jqelm.addClass('dragitem');
    actor_parts_top_jqelm.find('.select_actor_group').attr('contenteditable', 'true');
    actor_parts_top_jqelm.find('.select_actor_group').addClass('tdinput');
    actor_parts_top_jqelm.find('.actor_group_tracktxt').attr('hidden', '');

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
        SortableCreateActor(containers[i]);
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
            clips : []
        };
        const clips = groupElm.find('.actor_thumb_parent');
        for(let j = 0; j < clips.length; j++) {
            const clipElm = clips.eq(j);
            if(clipElm.attr('trash') == undefined)
            {
                const clip_obj = {
                    clip: clipElm.attr('name'),
                    tree_path: clipElm.attr('tree_path')
                };
                group_obj.clips.push(clip_obj);
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
    $('.actor_group_tracktxt').removeAttr('hidden');
    $('.dragitem').removeClass('.dragitem');
    $('#actor_switcher').removeClass('setting');
    $('#actor_parts_box').html('');

    const target = $(".actor_sequence_link[sequence='" + ActorIndexForSetting + "']");
    let actor_sequence_link_icon = target.find('.actor_sequence_link_icon');
    const actor_root = $('.actor_component[sequence="' + ActorIndexForSetting + '"]');
    actor_root.empty();
    if(target.hasClass('unlink')) {
        actor_sequence_link_icon.attr('uk-icon', 'ban');
    } else {
        actor_sequence_link_icon.attr('uk-icon', 'link');
        SetupActorComponent(ActorIndexForSetting);
    }
    $('.actor_sequence_link').removeAttr('hidden');
    $('[trash]').removeAttr('hidden');
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
        if($('#actor_switcher').hasClass('setting') && $(this).closest('#actor_switcher').length > 0 && $(this).hasClass('dragitem')) {
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
        let group_contextmenu = $('#group_contextmenu');
        group_contextmenu.css('left', e.pageX-window.scrollX + 'px');
        group_contextmenu.css('top', e.pageY-window.scrollY + 'px');
        if($('#actor_switcher').hasClass('setting') && $(this).closest('#actor_switcher').length > 0 && $(this).hasClass('dragitem')) {
            group_contextmenu.addClass('contextmenu_show');
            ContextmenuGroupSelectJQElm = $(this);
            if(ContextmenuGroupSelectJQElm.siblings('.actor_parts_top').length === 0) {
                $('#actor_setting_remove_group_button').addClass('events_disable');
            } else {
                $('#actor_setting_remove_group_button').removeClass('events_disable');
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
            const group = MakeGroupElement('New group', 0, [], null);
            SortableCreateActor(group.find('.actor_group')[0]);
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
            ContextmenuGroupSelectJQElm.siblings().attr('hidden', '');
            const clips = ContextmenuGroupSelectJQElm.find('.dragitem');
            clips.removeClass('dragitem');
            clips.filter('[data-type!=Anim]').attr('hidden', '');
            ContextmenuGroupSelectJQElm.removeClass('dragitem');
        }
    });

    document.body.addEventListener('click', function () {
        contextmenus.removeClass('contextmenu_show');
        ContextmenuPartsSelectJQElm = null;
        ContextmenuGroupSelectJQElm = null;
    });

    $('#animation_editor_thumbnav')[0].addEventListener('mousewheel', function(e) {
        const amount = 60;
        e.stopPropagation();
        var oEvent = e, 
            direction = oEvent.detail ? oEvent.detail * -amount : oEvent.wheelDelta, 
            position = $(this).scrollLeft();
        position += direction > 0 ? -amount : amount;
        $(this).scrollLeft(position);
        e.preventDefault();
    }, { passive: false });
    SortableCreateActor($('#animation_editor_thumbnav>ul')[0]);
}

function DeleteSelectedParts() {
    if(ContextmenuPartsSelectJQElm) {
        ContextmenuPartsSelectJQElm.remove();
        ContextmenuPartsSelectJQElm = null;
    }
    $('.selected').remove();
}