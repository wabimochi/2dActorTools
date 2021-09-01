const chokidar = require('chokidar');
let watcherId = 0;
let watcherList = [];
let importPathBuffer = [];
let importTrackBuffer = [];
let importBinBuffer = [];
let importExecuteId = null;

function autoImportStart(dirPath, matchingPatternList, matchingSourceList, importBinList, trackList) {
    const _matchingPatternList = matchingPatternList;
    const _matchingSourceList = matchingSourceList;
    const _importBinList = importBinList;
    const _trackList = trackList;
    let watcher = null;
    if(dirPath.lastIndexOf('/') != dirPath.length - 1) {
        dirPath += '/';
    }
    watcher = chokidar.watch(dirPath, {
        persistent:true,
        ignoreInitial:true,
        depth:0,
        disableGlobbing:true
    }).on('add', (path, stat) => {
        const ext = path.substr(path.lastIndexOf('.') + 1);
        if(!/[wW][aA][vV]|[mM][pP]3|[wW][mM][vV]/.test(ext)) {
            return;
        }
        const filename = path.substr(path.lastIndexOf('/') + 1);
        const length = _matchingSourceList.length;
        for(let i = 0; i < length; i++) {
            let text = null;
            if(_matchingSourceList[i] == 1) {
                const txt_filnename = path.slice(0, path.lastIndexOf('.') + 1) + 'txt';
                text = getFileText(txt_filnename);
            } else {
                text = filename;
            }
            if(text != null) {
                const reg = new RegExp(_matchingPatternList[i]);
                if(text.search(reg) != -1) {
                    if(importExecuteId != null) {
                        clearTimeout(importExecuteId);
                    }
                    importPathBuffer.push(path.replace(/\\/g, '/'));
                    importTrackBuffer.push(_trackList[i] - 1);
                    importBinBuffer.push(_importBinList[i]);
                    importExecuteId = setTimeout(importExecute, 500);
                    break;
                }
            }
        }
    });
    watcherId++;
    watcherList[watcherId] = watcher;
    return watcherId;
}

function importExecute() {
    csInterface.evalScript('$._PPP_.ImportFiles("' + importPathBuffer.join('\\\\') + '","' + importTrackBuffer.join('\\\\') + '","' + importBinBuffer.join('\\\\') + '")');
    importPathBuffer = [];
    importTrackBuffer = [];
    importBinBuffer = [];
    importExecuteId = null;
}

function autoImportStop (id) {
    watcherList[id].close();
}

function addAutoImportWatchDir() {
    const watch_div =  $('<div>', {'class':'watch_dir_element'});
    const path_input = $('<input>', {'class':'uk-input uk-margin-large-left uk-padding-small uk-light uk-width-expand tdinput auto_import_dir_path' ,'type':'text', placeholder:'監視フォルダのパス'});
        path_input[0].addEventListener('change', function(e) {
            e = $(e.target);
            e.val(e.val().replace(/\\/g, '/'));
            setSettingFlag(e, fs.existsSync(e.val()));
        });
    const a1 = $('<a>', {href:'#', 'class':'uk-width-auto grid_icon' ,'uk-icon':'icon: folder'});
        a1[0].addEventListener('click', function(e) {
            const watch_dir = window.cep.fs.showOpenDialogEx(false, true, '監視フォルダの選択', null).data;
            if(watch_dir == '') return;
            const pathInput = $(e.target).closest('a').prevAll('input');
            pathInput.val(watch_dir[0]);
            setSettingOK(pathInput);
        });
    const a2 = $('<a>', {href:'#', 'class':'uk-width-auto grid_icon' ,'uk-icon':'icon: link'});
        a2[0].addEventListener('click', function(e) {
            const target = $(e.target).closest('a');
            const elm = target.closest('.watch_dir_element');
            if(target.hasClass('tdact_setting_ok')) {
                autoImportStop(target.val());
                target.removeClass('tdact_setting_ok');
                elm.find('*').each(function(i, o) { 
                    $(o).removeClass('events_disable');
                }); 
            } else {
                const dirPathInput = elm.find('.auto_import_dir_path');
                const dirPath = dirPathInput.val();
                const body = elm.find('tbody');

                let invalid = false;
                if(!fs.existsSync(dirPath)) {
                    dirPathInput.addClass('tdact_setting_error');
                    invalid = true;
                }
                body.find('.auto_import_bin').each(function(i, o) { 
                    const bin_button = $(o);
                    if(!bin_button.hasClass('tdact_setting_ok')) {
                        bin_button.addClass('tdact_setting_error');
                        invalid = true;
                    } else {
                        bin_button.removeClass('tdact_setting_error');							
                    }
                }); 
                body.find('.auto_import_matching_pattern').each(function(i, o) { 
                    const matching_pattern = $(o);
                    if(matching_pattern.val() == '') {
                        matching_pattern.addClass('tdact_setting_error');
                        invalid = true;
                    } else {
                        setSettingOK(matching_pattern);
                    }
                });

                body.find('.auto_import_track_selector').each(function(i, o) { 
                    const track_selector = $(o);
                    if(track_selector.hasClass('tdact_setting_error')) {
                        invalid = true;
                    }
                });

                if(invalid) return;
                const matchingPatternList = [];
                body.find('.auto_import_matching_pattern').each(function(i, o) { matchingPatternList.push($(o).val()); });
                const matchingSourceList = [];
                body.find('.auto_import_source').each(function(i, o) { matchingSourceList.push($(o).val()); });
                const importBinList = [];
                body.find('.auto_import_bin').each(function(i, o) { importBinList.push($(o).html()); });
                const trackList = [];
                body.find('.auto_import_track_selector').each(function(i, o) { trackList.push($(o).val()); });

                const id = autoImportStart(dirPath, matchingPatternList, matchingSourceList, importBinList, trackList);				
                target.val(id);
                target.addClass('tdact_setting_ok');
                elm.find('table').each(function(i, o) { 
                    $(o).addClass('events_disable');
                });
                elm.find('.auto_import_add_rule_button').addClass('events_disable');
                const head = elm.children().eq(0);
                head.find('a').each(function(i, o) { 
                    $(o).addClass('events_disable');
                });
                head.find('input').each(function(i, o) { 
                    $(o).addClass('events_disable');
                });
                target.removeClass('events_disable');
                SaveAutoImportSettings();
            }
        });
    const a3 = $('<a>', {href:'#', 'class':'uk-width-auto grid_icon' ,'uk-icon':'icon: trash'});
        a3[0].addEventListener('click', function(e) {
            if(!confirm('この監視フォルダ設定を削除しますか？')){
                return false;
            } else {
                $(e.target).closest('.watch_dir_element').remove();
                SaveAutoImportSettings();
            }
        });
    const path_div =  $('<div>', {'class':'uk-grid uk-grid-match uk-child-width-auto@ss'});
        path_div.append(path_input);
        path_div.append(a1);
        path_div.append(a2);
        path_div.append(a3);
    watch_div.append(path_div);

    const body = $('<tbody>');
    const table = $('<table>', {'class':'uk-table uk-table-small uk-table-middle uk-table-justify'});
        table.append(body);

        const button = $('<button>', {'class':'uk-button uk-button-secondary uk-width-auto uk-flex uk-flex-center auto_import_add_rule_button'});
        button.html('ルール追加');
        button[0].addEventListener('click', function(e) {
            let parent = $(e.target.parentNode);
            let tbody = parent.prev('table').children('tbody');
            addAutoImportRule(tbody);
        });
        const add_rule_div = $('<div>', {'class':'uk-flex uk-flex-center'});
        add_rule_div.append(button);
        const table_div = $('<div>', {'class':'uk-overflow-auto uk-margin-left'});
        table_div.append(table);
        table_div.append(add_rule_div);
    watch_div.append(table_div);
    watch_div.append($('<hr>'));

    const ai_root = $("#auto_import_root");
        ai_root.append(watch_div);

    return watch_div;
}

function addAutoImportRule(jqTbody) {
    const select1 = $('<select>', {'class':'tdactor_selectbox uk-width-auto uk-select auto_import_source'});
    const s1_option1 = $('<option>', {value:'1'})
        s1_option1.html('.txt内容');
    const s1_option2 = $('<option>', {value:'2'})
        s1_option2.html('ファイル名');
    select1.append(s1_option1);
    select1.append(s1_option2);
    const td1 = $('<td>', {'class':'uk-text-nowrap uk-table-shrink'});
        td1.append(select1);

    const button1 = $('<button>', {'class':'uk-button uk-button-secondary uppercase_disable text_ellipsis auto_import_bin'});
        button1.html('選択中のビンをセット');
        button1[0].addEventListener('click', function(e) {
            const treePath = SetectedProjectItemTreePath;
            csInterface.evalScript('$._PPP_.ExistBinTreePath("' + treePath + '")', function(result) {
                if(result) {
                    e = $(e.target);
                    e.html(treePath);
                    e.attr('uk-tooltip', treePath);
                    setSettingOK(e);
                }
            });
        });
    const td2 = $('<td>', {'class':'uk-text-nowrap uk-table-shrink'});
        td2.append(button1);
    const select2 = $('<select>', {'class':'tdactor_selectbox uk-width-auto uk-select auto_import_track_selector'});
        const s2_option = $('<option>', {value:"0"})
        s2_option.html('Track');
        select2.append(s2_option);
        select2[0].addEventListener('change', function(e) {
            const selectbox = $(e.target);
            const max_value = Number(selectbox.attr('max_track_num'));
            if(max_value && Number(selectbox.val()) > max_value) {
                setSettingError(selectbox);
                selectbox.attr('uk-tooltip', max_value + ' 以下を選択してください');
            } else {
                setSettingOK(selectbox);
                selectbox.removeAttr('uk-tooltip');
            }
        });
        audioTrackSelectBox.push(select2);
        csInterface.evalScript('$._PPP_.SequenceStructureChanged()');
    const td3 = $('<td>', {'class':'uk-text-nowrap uk-table-shrink'});
        td3.append(select2);
    const input = $('<input>', {'class':'uk-input uk-light tdinput auto_import_matching_pattern', type:'text', placeholder:'マッチングパターン'});
        input[0].addEventListener('change', function(e) {
            resetSettingFlag($(e.target));
        });
    const td4 = $('<td>', {'class':'uk-text-nowrap'});
        td4.append(input);
    const a = $('<a>', {href:'#', 'class':'icon_s', 'uk-icon':'icon: trash'})
    const td5 = $('<td>', {'class':'uk-text-nowrap'});
        td5.append(a);
        td5[0].addEventListener('click', function(e) {
            if(!confirm('振り分けルールを削除しますか？')){
                return false;
            } else {
                const target_tr = $(e.target).closest('tr');
                const track_selector = target_tr.find('.auto_import_track_selector');
                const length = audioTrackSelectBox.length;
                for(let i = 0; i < length; i++){
                    if(track_selector.is(audioTrackSelectBox[i])) {
                        audioTrackSelectBox.splice(i, 1);
                        break;
                    }
                }
                $(e.target).closest('tr').remove();
                SaveAutoImportSettings();
            }
        });

    const tr = $('<tr>');
        tr.append(td4);
        tr.append(td1);
        tr.append(td2);
        tr.append(td3);
        tr.append(td5);
    jqTbody.append(tr);
    return tr;
}

function SaveAutoImportSettings() {
    const autoImportSettings = {}
    $('#auto_import_root').children('.watch_dir_element').each(function(i, o) {
        const watch_dir = {}; 
        watch_dir['import_dir_path'] = $(o).find('.auto_import_dir_path').val();
        const tbody = $(o).find('tbody');
        const rules = [];
        tbody.children('tr').each(function(tr_i, tr_o) {
            const tdList = $(tr_o).children('td');
            const rule = {};
            const selectbox = tdList.children('select');
            rule['pattern'] = tdList.children('input').eq(0).val();
            rule['source'] = selectbox.eq(0).val();
            rule['import_bin'] = tdList.children('button').eq(0).html();
            rule['track_number'] = selectbox.eq(1).val();
            rules.push(rule);
        });
        watch_dir['rules'] = rules;
        autoImportSettings[i] = watch_dir;
    });
    SettingUpdate('auto_import', 'auto_import_settings_id', autoImportSettings);
}

// AutoImportInitialize
CustomInitialize['auto_import_custum_initialize'] = function () {
    const category = ExtensionSettings['auto_import'];
    if(category) {
        const settingRoot = category['auto_import_settings_id'];
        for(index in settingRoot) {
            const dirElm = addAutoImportWatchDir();
            const watch_dir = settingRoot[index];
            const watch_dir_path = watch_dir['import_dir_path'];
            const watch_dir_input = dirElm.find('.auto_import_dir_path');
            watch_dir_input.val(watch_dir_path);
            if(fs.existsSync(watch_dir_path)) {
                watch_dir_input.addClass('tdact_setting_ok');
            } else {
                watch_dir_input.addClass('tdact_setting_error');
            }
            const tbody = dirElm.find('tbody');
            const rules = watch_dir['rules'];
            const rulesLength = rules.length;
            for(let i = 0; i < rulesLength; i++) {
                const rule = rules[i];
                const tr = addAutoImportRule(tbody);
                const tdList = tr.children('td');
                const selectbox = tdList.children('select');
                tdList.children('input').eq(0).val(rule['pattern']);
                selectbox.eq(0).val(rule['source']);
                const binTreePath = rule['import_bin'];
                const binButton = tdList.children('button').eq(0);
                binButton.html(binTreePath);
                csInterface.evalScript('$._PPP_.ExistBinTreePath("' + binTreePath + '")', function(result) {
                    binButton.attr('uk-tooltip', binTreePath);
                    if(result) {
                        binButton.addClass('tdact_setting_ok');
                    } else {
                        binButton.addClass('tdact_setting_error');
                    }
                });

                const trackNum = Number(rule['track_number']);
                const trackSelectbox = selectbox.eq(1);
                const currentTrackNum = trackSelectbox.children().length;
                if(currentTrackNum <= trackNum) {
                    let value = currentTrackNum;
                    while(trackSelectbox.children().length <= trackNum) {
                        const op = $('<option>', {'value':value});
                            op.html(value);
                            trackSelectbox.append(op);
                        value += 1;
                    }
                    setSettingError(trackSelectbox);
                    trackSelectbox.attr('uk-tooltip', currentTrackNum + ' 以下を選択してください');
                    trackSelectbox.attr('max_track_num', currentTrackNum);
                }
                trackSelectbox.val(trackNum);
                trackSelectbox.change();
            }
        }
    }
}