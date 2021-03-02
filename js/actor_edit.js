$('#select_actor_setting').on('change', function(e) {
    $('#actor_setting_save_button').addClass('disable');
    $('#actor_setting_initialize').addClass('disable');
    clearActorSettingPanel();
});

$(document).on('click', '.dragitem', function() {
    var path = $(this).attr('src');
    if(path) {
        var thumb = $('#actor_setup_thumb');
        thumb.attr('src', path);
        transparent_crop_async(path, setupCropImageSet);
    }
});

$(document).on('click', '.actor_sequence_link.unlink', function() {
    var index = $(this).attr('sequence');
    var actorName = $(this).children('.actor_sequence_link_label').html();
    var actor_sequence_link = $(this);
    var actor_sequence_link_icon = $(this).find('.actor_sequence_link_icon');
    $('.actor_sequence_link').removeClass('enable');
    $('#actor_switcher').find('li').removeClass('uk-active');
    var target_actor_component = $('#actor_switcher').find("[sequence='" + index + "']");
    var actor_root = $('.actor_component[sequence="' + index + '"]');
    
    var csInterface = new CSInterface();
    csInterface.evalScript('$._PPP_.getActorStructureMediaPath("' + actorName + '")', function(actorStructPath) {
        if(actorStructPath === '') {
            alert("構成ファイルが見つかりません。立ち絵設定を行ってください");
            var function_switch = $('#function_switch').children('li');
            var actor_functions = $('#actor_functions').children('li');
            function_switch.eq(2).removeClass('uk-active');
            actor_functions.eq(2).removeClass('uk-active');
            function_switch.eq(3).addClass('uk-active');
            actor_functions.eq(3).addClass('uk-active');
            document.getElementById('select_actor_setting').selectedIndex = index;
            actorSettingStart();
        } else {
            csInterface.evalScript('$._PPP_.setLinkSequence("' + index + '")', function(result) {
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
                            csInterface.evalScript('$._PPP_.getActorStructureMediaPath("' + actorName + '")', function(result) {
                                if(result) {
                                    ActorStructure[index] = LoadActorStructure(result);
                                    if(ActorStructure[index]) {
                                        var treePath = '';
                                        for(var i = 0; i < ActorStructure[index].actor.length - 1; i++) {
                                            var clips = ActorStructure[index].actor[i].clips;
                                            for(var j = 0; j < clips.length; j++){
                                                treePath = clips[j].tree_path;
                                                i = ActorStructure[index].actor.length;
                                                break;
                                            }
                                        }
                                        csInterface.evalScript('$._PPP_.createActorSequence("' + actorName + '","' + treePath + '")');
                                    }
                                }
                            });
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
        $(this).parents('.actor_parts').find('.td-thumbnav').removeClass('disable');
    } else {
        $(this).attr('uk-icon', 'lock');
        $(this).parents('.actor_parts').find('.td-thumbnav').addClass('disable');
    }
});

$(document).on('click', '.actor_insert_setting', function() {
    enableSwitch($(this));
});

$(document).on('click', '.actor_thumb_parent', function() {
    var linkdActor = $('.actor_sequence_link');
    let actorName = '';
    for(var i = 0; i < linkdActor.length; i++) {
        if(linkdActor.eq(i).hasClass('enable'))
            actorName = linkdActor.eq(i).children('.actor_sequence_link_label').html();
    }
    let tree_path = $(this).attr('tree_path');
    let group_index = $(this).attr('group_index');
    let seq_index = $('.actor_linknav > ul > .enable').attr('sequence');
    let insert_mode = $(this).parents('.parts_selector');
    let flag = 0;
    if(insert_mode.find('.insert_inpoint').hasClass('enable')) flag += 1;
    if(insert_mode.find('.insert_outpoint').hasClass('enable')) flag += 2;
    if(insert_mode.find('.insert_marker').hasClass('enable')) flag += 4;
    insertActorClip(actorName, seq_index, group_index, tree_path, flag);
});

$(document).on('mouseenter', '.actor_thumb_parent', function() {
    let actor_label = $(this).parents('.actor_parts').find('.select_actor_label');
    actor_label.html($(this).attr('name'));
});
$(document).on('mouseleave ', '.actor_thumb_parent', function() {
    let actor_label = $(this).parents('.actor_parts').find('.select_actor_label');
    actor_label.html('');
});

$(document).on("click", ".group_trash", function(e) {
    if(!confirm('グループを削除しますか?')){
        return false;
    }else{
        let group = $(this).parents('.container');
        let child = group.children('.dragitem');
        group.children('.dragitem').appendTo($('#actor_not_use'));
        group.remove();
    }
});

function actorSelectBoxUpdate() {
    let select_actor = $('#select_actor_setting');
    let actor_linknav = $('.actor_linknav ul');
    let actor_switcher = $('#actor_switcher');
    actor_linknav.empty();
    actor_switcher.empty();

    var csInterface = new CSInterface();
    csInterface.evalScript('$._PPP_.getActorBinName()', function(names) {
        select_actor.each(function() {
            var nameList = names.split(',');
            for(let i = 0; i < nameList.length; i++) {
                var act_switch = $('<li>', {'class':'', sequence:i});
                act_switch.append($('<div>', {'class':'actor_component', sequence:i}));
                actor_switcher.append(act_switch);

                var li = $('<li>', {'class': 'actor_sequence_link uk-width-auto unlink', sequence : i});
                var div_icon = $('<div>', {'class':'actor_sequence_link_icon', 'uk-icon':'ban'});
                var div_label = $('<div>', {'class':'actor_sequence_link_label'});
                    div_label.html(nameList[i]);
                li.append(div_icon);
                li.append(div_label);
                actor_linknav.append(li);
                
                if(i < this.childNodes.length){
                    this.childNodes[i].innerHTML = nameList[i];
                    this.childNodes[i].value =  nameList[i];
                } else {
                    let option = document.createElement('option');
                    option.setAttribute('value', nameList[i]);
                    option.innerHTML = nameList[i];
                    this.appendChild(option);
                }
            }
            while(nameList.length < this.childNodes.length) {
                this.removeChild(this.lastChild);
            }
        });
    });
}

function clearActorSettingPanel() {
    var notuse = $('#actor_not_use');
    notuse.empty();
    notuse.html('<summary>Not use</summary>');
    $('#root_container').empty();
}

function addActorSettingPanel() {
    SortableSet();
    $('#add_group').change(function(e) {
        let name = $(this).val();
        if(name !== ''){
            AddGroup(name);
            $(this).val('');
        }
    });
}

function actorSettingStart(force_initialize) {
    clearActorSettingPanel();
    addActorSettingPanel();
    var actor = document.getElementById("select_actor_setting");
    var csInterface = new CSInterface();

    csInterface.evalScript('$._PPP_.getActorStructureMediaPath("' + actor.value + '")', function(result) {
        let mediaPathList = result.split(',');
        if(result !== '' && mediaPathList.length == 1 && !force_initialize) {
            $('#actor_setting_save_button.disable').removeClass('disable');
            $('#actor_setting_initialize.disable').removeClass('disable');
            var actorObj = LoadActorStructure(mediaPathList[0]);
            for(var i = 0; i < actorObj.actor.length - 1; i++) {
                var group = AddGroup(actorObj.actor[i].group);
                var clips = actorObj.actor[i].clips;
                for(var j = 0; j < clips.length; j++) {
                    if(fs.existsSync(clips[j].src_path) ) {
                        AddActorClip(group, clips[j].clip, clips[j].src_path, clips[j].tree_path, clips[j].crop_path);
                    }
                }
            }
            var group = $('#actor_not_use');
            var clips = actorObj.actor[actorObj.actor.length - 1].clips;
            for(var j = 0; j < clips.length; j++) {
                AddActorClip(group, clips[j].clip, clips[j].src_path, clips[j].tree_path, clips[j].crop_path);
            }
        } else {
            csInterface.evalScript('$._PPP_.getActorStructure("'+ actor.value + '")', function(struct) {
                if(struct) {
                    $('#actor_setting_save_button.disable').removeClass('disable');
                    $('#actor_setting_initialize.disable').removeClass('disable');
                    let elmNum = 4;
                    var structList = struct.split(',');
                    let length = structList.length / elmNum;
                    var prevGroupName = ""
                    var prevGroup = null;
                    for(let i = 0; i < length; i++) {
                        let currentGroupName = structList[i * elmNum + 1];
                        if(currentGroupName !== prevGroupName){
                            prevGroup = AddGroup(currentGroupName);
                            prevGroupName = currentGroupName;
                        }
                        AddActorClip(prevGroup, structList[i * elmNum], structList[i * elmNum + 2], structList[i * elmNum + 3], '');
                    }
                } else {
                    $('#actor_setting_save_button').addClass('disable');
                    $('#actor_setting_initialize').addClass('disable');
                }
            });
        }
    });	
}

function setActorClipSet(shortcutKey) {
    var linkdActor = $('.actor_sequence_link');
    for(var i = 0; i < linkdActor.length; i++) {
        if(linkdActor.eq(i).hasClass('enable')) {
            let seqIndex = linkdActor.eq(i).attr('sequence');
            var actorName = linkdActor.eq(i).children('.actor_sequence_link_label').html();
            let actorFlagList = $('#actor_switcher').children('[sequence=' + seqIndex + ']').find('.parts_selector');
            var treePathList = ActorStructure[seqIndex].clipset[shortcutKey].split(',');
            for(var j = 0; j < treePathList.length; j++) {
                let flag = 0;
                let insert_mode = actorFlagList.eq(actorFlagList.length - 1 - j);
                if(!insert_mode.find('.insert_disable').hasClass('enable')) {
                    if(insert_mode.find('.insert_inpoint').hasClass('enable')) flag += 1;
                    if(insert_mode.find('.insert_outpoint').hasClass('enable')) flag += 2;
                    if(insert_mode.find('.insert_marker').hasClass('enable')) flag += 4;
                    insertActorClip(actorName, seqIndex, j, treePathList[j], flag);
                }
            }
        }
    }
}

function getActorClipSet(shortcutKey) {
    var linkdActor = $('.actor_sequence_link');
    for(var i = 0; i < linkdActor.length; i++) {
        if(linkdActor.eq(i).hasClass('enable')) {
            let seqIndex = linkdActor.eq(i).attr('sequence');
            var actorName = linkdActor.eq(i).children('.actor_sequence_link_label').html();
            var csInterface = new CSInterface();
            csInterface.evalScript('$._PPP_.getCurrentActorClipTreePath(' + seqIndex + ',-1)', function(treePathList) {
                if(!('clipset' in ActorStructure[seqIndex])){
                    ActorStructure[seqIndex].clipset = {};
                } 
                ActorStructure[seqIndex].clipset[shortcutKey] = treePathList;
                csInterface.evalScript('$._PPP_.getActorStructureMediaPath("' + actorName + '")', function(result) {
                    let mediaPathList = result.split(',');
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
    var csInterface = new CSInterface();
    csInterface.evalScript('$._PPP_.insertActorClip("' + actor_name + '",' + seq_index + ','+ group_index + ',"' + tree_path + '",-1,' + flag + ')');	
}

function SortableSet() {
    var root_container = document.querySelector('.root_container');
    new Sortable.create(root_container, {
        group: 'root',
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
        
    var containers = null;
    containers = document.querySelectorAll('.container');
    for (var i = 0; i < containers.length; i++) {
        new Sortable.create(containers[i], {
            group: 'nested',
            multiDrag: true,
            draggable: '.dragitem',
            filter: '.filtered',
            selectedClass: 'selected',
            dragClass: 'sortable-drag',
            ghostClass: 'sortable-ghost',
            animation: 150,
            fallbackOnBody: true,
            swapThreshold: 0.65,
            dragoverBubble: false});
    };
}

function AddGroup(name) {
    var summary = $('<summary>', {class:'group_label'});
    summary.html(name + ' <a href="#" class="group_trash" uk-icon="icon: trash"></a>');
    var details = $('<details>', {class:'container dragitem', group:name});
    details.append(summary);
    if($('.container.dragitem:last').length){
        $('.container.dragitem:last').after(details);
    } else {
        $('#root_container').append(details);
    }
    new Sortable.create(details[0], {
        group: 'nested',
        multiDrag: true,
        draggable: '.dragitem',
        filter: '.filtered',
        selectedClass: 'selected',
        dragClass: 'sortable-drag',
        ghostClass: 'sortable-ghost',
        animation: 150,
        fallbackOnBody: true,
        swapThreshold: 0.65,
        dragoverBubble: false,
    });
    return details;
}

function AddActorClip(rootNode, name, img_path, tree_path, crop_path) {
    var item = $(document.createElement('div'));
    item.addClass('dragitem');
    item.html(name);
    item.attr('clip', name);
    item.attr('tree_path', tree_path);
    item.attr('src', img_path);
    item.attr('crop_path', crop_path);
    rootNode.append(item);
}

function setupCropImageSet(base64) 
{
    var zoom = $('#actor_setup_zoom');
    zoom.attr('href', base64);
}

function SaveNewActorStructure() {
    const path = _ActorStructureSave();
    if(path) {
        const actorName = $("#select_actor_setting").val();
        var csInterface = new CSInterface();
        csInterface.evalScript('$._PPP_.importActorStructureFile("' + path.replace(/\\/g, '/') + '","'+ actorName + '")', function(result) {
            if(!result) {
                alert('構成ファイルのインポートに失敗しました');
            }
            clearActorSettingPanel();
        });	
    }
}

function OverwriteActorStructure() {
    const actorName = $("#select_actor_setting").val();
    var csInterface = new CSInterface();
    csInterface.evalScript('$._PPP_.getActorStructureMediaPath("' + actorName + '")', function(result) {
        let mediaPathList = result.split(',');
        if(result !== '' && mediaPathList.length == 1) {
            var index = $(this).attr('sequence');
            var actor_root = $('.actor_component[sequence="' + index + '"]');
            actor_root.empty();

            let linklabel = $('.actor_sequence_link_label');
            for(var i = 0; i < linklabel.length; i++) {
                if(linklabel.eq(i).html() === actorName) {
                    $('.actor_sequence_link').removeClass('enable');
                    let root = linklabel.eq(i).parents('.actor_sequence_link');
                    root.removeClass('linked');
                    root.addClass('unlink');
                    root.find('.actor_sequence_link_icon').attr('uk-icon', 'ban');;
                    $('#actor_switcher').find('li').removeClass('uk-active');						
                    break;
                }
            }

            var actor = LoadActorStructure(mediaPathList[0]);
            _ActorStructureSave(mediaPathList[0], actor);
            clearActorSettingPanel();
        }
        else {
            SaveNewActorStructure();
        }
    });	
}

function InitializeActorStructure() {
    if(!confirm('設定を初期化しますか？')){
        return false;
    } else {
        actorSettingStart(true);
    }
}

function SetupActorComponent(index, actorName){
    var csInterface = new CSInterface();
    csInterface.evalScript('$._PPP_.getActorStructureMediaPath("' + actorName + '")', function(result) {
        if(result) {
            ActorStructure[index] = LoadActorStructure(result);
            var actorObj = ActorStructure[index];
            if(actorObj) {
                actor_root = $('.actor_component[sequence="' + index + '"]');
                for(var i = 0; i < actorObj.actor.length - 1; i++) {
                    var actor = $('<div>', {'class':'actor_parts'});

                    var label = $('<div>');
                    label.attr('uk-grid', '');

                    var group = $('<div>');
                    group.addClass('uk-width-expand select_actor_group');
                    group.html(actorObj.actor[i].group);
                    label.append(group);

                    var partsName = $('<div>', {'class':'uk-width-auto uk-text-right select_actor_label'});
                    label.append(partsName);

                    actor.append(label);

                    var partsSelector = $('<div>', {'class':'uk-text-center uk-padding uk-padding-small uk-padding-remove-vertical remove-top-margine parts_selector'});
                    partsSelector.attr('uk-grid', '');
                    
                    var checkbox_div = $('<div>', {'class':'uk-width-auto uk-height-expand insert_mode'});
                    checkbox_div.append($('<div>', {'uk-icon': 'unlock', 'class': 'uk-icon actor_insert_setting insert_setting_icon insert_disable'}));
                    
                    let inpointClipIcon = $('<div>', {'class': 'actor_insert_setting insert_setting_icon insert_inpoint enable'});
                        inpointClipIcon.html(`<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 100 100" style="enable-background:new 0 0 100 100;" xml:space="preserve"><g><line class="insert_inpoint1" x1="2.6" y1="50.5" x2="53.1" y2="50.5"/><g><line class="insert_inpoint1" x1="2.6" y1="50.5" x2="34.1" y2="50.5"/><g><polygon class="insert_inpoint1" points="30.2,63.8 53.1,50.5 30.2,37.2 "/></g></g></g><rect x="56.2" y="9" class="insert_inpoint2" width="40.7" height="83.8"/><polygon class="insert_inpoint1" points="77.7,9 56.2,31.8 56.2,92.8 96.8,92.8 96.8,9 "/></svg>`);

                    let outpointClipIcon = $('<div>', {'class': 'actor_insert_setting insert_setting_icon insert_outpoint disable'});
                        outpointClipIcon.html(`<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 100 100" style="enable-background:new 0 0 100 100;" xml:space="preserve"><polygon class="insert_outpoint4" points="14.3,92.8 85.8,92.8 85.8,9 14.2,9 "/><polygon class="insert_outpoint1" points="64.3,9 85.8,31.8 85.8,92.8 14.3,92.8 14.2,9 "/><g><line class="insert_outpoint3" x1="31.1" y1="50" x2="81.6" y2="50"/><g><line class="insert_outpoint3" x1="31.1" y1="50" x2="62.6" y2="50"/><g><polygon class="insert_outpoint3" points="58.7,63.3 81.6,50 58.7,36.7 "/></g></g></g></svg>`);


                    let markerIcon = $('<div>', {'class': 'actor_insert_setting insert_setting_icon insert_marker disable'});
                        markerIcon.html('<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"\
                                        viewBox="0 0 100 100" style="enable-background:new 0 0 100 100;" xml:space="preserve">\
                                    <polygon class="marker_icon" points="23.1,58.425 23.1,18 76.57,18 76.57,58.425 49.535,83 23.1,58.425 "/></svg>');

                    checkbox_div.append(inpointClipIcon);
                    checkbox_div.append(outpointClipIcon);
                    checkbox_div.append(markerIcon);
                    partsSelector.append(checkbox_div);

                    var partsList = $('<div>', {'class':'uk-width-expand uk-flex uk-flex-left actor_parts_list'});
                    var thumbnav = $('<div>', {'class':'td-thumbnav'});

                    var ul = $('<ul>');
                    var clips = actorObj.actor[i].clips;
                    for(var j = 0; j < clips.length; j++){
                        var li = $('<li>', {'class':'actor_thumb_parent', name:clips[j].clip, tree_path:clips[j].tree_path, group_index: actorObj.actor.length - 2 - i});
                        var img = $('<img>', {'class':'actor_thumb'});
                        var crop = clips[j].crop_path;
                        if (crop && fs.existsSync(crop)) {
                            img.attr('src', crop);
                            li.append(img);
                        } else {
                            li.append($('<span>', {'uk-icon':'icon: question; ratio:2'}));
                        }
                        ul.append(li);
                    }
                    var li = $('<li>', {'class':'actor_thumb_parent', name:'このクリップを消す', tree_path:'delete', group_index: actorObj.actor.length - 2 - i});
                    var dummy = $('<span>', {'uk-icon':'icon: trash; ratio:2'});
                    li.append(dummy);
                    ul.append(li);
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

                    thumbnav.append(ul);
                    partsList.append(thumbnav);
                    partsSelector.append(partsList);
                    actor.append(partsSelector);
                    actor_root.append(actor);
                }
            }
        }
    });
}

function LoadActorStructure(path)	{
    json = window.cep.fs.readFile(path);
    if(json.err){
        if(json.err == window.cep.fs.ERR_NOT_FOUND) {
            alert('"' + path + '"が見つかりません。');
            return null;
        } else {
            alert("err : " + json.err);
        }
    }
    return JSON.parse(json.data);
}

let cropImageCounter = 0;
let cropImageSize = 0;
function _ActorStructureSave(save_structure_file_path, currentActorObj)
{
    if(!save_structure_file_path) {
        const actorName = $("#select_actor_setting").val();
        save_structure_file_path = window.cep.fs.showSaveDialogEx('構成ファイルの保存先', '', ['txt'], actorName + '.txt').data;
        if(!save_structure_file_path) return;
    }

    var obj = [];	
    var crop_dir = '';
    var crop_list = [];

    let groupList = $('.container.dragitem');
    for(var i = 0; i < groupList.length; i++) {
        var group_obj = { 
            group : groupList[i].getAttribute('group'),
            clips : []
        };
        var clips = $(groupList[i]).children('.dragitem');
        for(var j = 0; j < clips.length; j++){
            let crop_path = clips[j].getAttribute('crop_path');
            let clip_name = clips[j].getAttribute('clip');
            if(crop_path === '' || !fs.existsSync(crop_path)) {
                if(!crop_dir){
                    crop_dir = window.cep.fs.showOpenDialogEx(false, true, 'サムネイルの保存先', null).data;
                    if(crop_dir == '') return;
                    crop_dir += '/';
                }
                let src_path = clips[j].getAttribute('src');
                let lastIndex = src_path.lastIndexOf(".");
                crop_path = crop_dir + clip_name + GetUUID() + src_path.substr(lastIndex);
                crop_list.push({src:src_path, dst:crop_path});
            }
            var clip_pbj = {
                clip: clip_name,
                src_path: clips[j].getAttribute('src'),
                tree_path: clips[j].getAttribute('tree_path'),
                crop_path: crop_path
            };
            group_obj.clips.push(clip_pbj);
        }
        obj.push(group_obj);
    }

    var group_obj = { 
        group : 'notuse',
        clips : []
    };
    var clips = $('#actor_not_use').children('.dragitem');
    for(var j = 0; j < clips.length; j++){
        let crop_path =  clips[j].getAttribute('crop_path');
        let clip_name = clips[j].getAttribute('clip');
        if(crop_path === '' || !fs.existsSync(crop_path)) {
            if(!crop_dir) {
                crop_dir = window.cep.fs.showOpenDialog(false, true, 'サムネイルの保存先', '').data;
                if(crop_dir == '') return;
                crop_dir += '/';
            }
            let src_path = clips[j].getAttribute('src');
            let lastIndex = src_path.lastIndexOf(".");
            crop_path = crop_dir + clip_name + GetUUID() + src_path.substr(lastIndex);
            crop_list.push({src:src_path, dst:crop_path});
        }
        var clip_pbj = {
            clip: clips[j].getAttribute('clip'),
            src_path: clips[j].getAttribute('src'),
            tree_path: clips[j].getAttribute('tree_path'),
            crop_path: crop_path
        };
        group_obj.clips.push(clip_pbj);
    }
    obj.push(group_obj);
    var wrapper = {actor: obj};
    if(currentActorObj) {
        wrapper['clipset'] = currentActorObj.clipset;
    } else {
        wrapper['clipset'] = {};
    }
    const err = SaveJson(wrapper, save_structure_file_path);
    if(err != window.cep.fs.NO_ERROR) {
        alert(CEP_ERROR_TO_MESSAGE[err]);
    }
    $('#actor_setting_save_button').addClass('disable');
    $('#actor_setting_initialize').addClass('disable');

    cropImageCounter = 0;
    cropImageSize = crop_list.length;
    if(cropImageSize > 0) {
        $('#mainfunc').addClass('disable');
        $('#busy_notification').addClass('uk-open');
        $('#busy_notification').attr('style', 'display: block;');
        for(var i = 0; i < cropImageSize; i++) {
            save_transparent_crop(crop_list[i].src, crop_list[i].dst, cropImageCallback);
        }
    }
    return save_structure_file_path;
}

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
function transparent_crop_async(path, callback)	{
    console.log(path);
    Jimp.read(path, (err, image) => {
        if (!err) {
            image.autocrop = autocrop;
            image.autocrop(5);
            image.getBase64Async(Jimp.AUTO).then(callback);
        } 
    });
}

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