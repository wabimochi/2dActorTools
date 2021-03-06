function SaveSettings() {
    if(ExtensionSettingsFilePath) {
        return SaveJson(ExtensionSettings, ExtensionSettingsFilePath);
    }
}

function LoadSettings()	{
    csInterface.evalScript('$._PPP_.getSettingsMediaPath()', function(result){
        if(result) {
            const json = window.cep.fs.readFile(result);
            if(json.err){
                $('#setting_file_not_exist_icon').css('visibility','visible');
                if(json.err != window.cep.fs.ERR_NOT_FOUND) {
                    alert(CEP_ERROR_TO_MESSAGE[json.err]);
                }
            } else {
                $('#setting_file_not_exist_icon').css('visibility','hidden');
                ExtensionSettingsFilePath = result;
                ExtensionSettings = JSON.parse(json.data);
            }
        } else {
            $('#setting_file_not_exist_icon').css('visibility','visible');
        }
        ApplySettings();
    });
}

function ApplySettings() {
    for(category in ExtensionSettings) {
        const setting = ExtensionSettings[category];
        for(id in setting) {
            const target = $('#' + id);
            if(target) {
                const type = target.attr('type');
                if(type === 'text' || type === 'selectbox') {
                    target.val(setting[id]);
                } else if(type === 'checkbox') {
                    if(setting[id] == '0') {
                        target.prop('checked', false);
                    } else {
                        target.prop('checked', true);
                    }
                }
            }
        }
    }

    for(id in CustomInitialize) {
        CustomInitialize[id]();
    }
}

function NewSettingFile() {
    const savedir = window.cep.fs.showOpenDialogEx(false, true, '設定の保存先フォルダの選択', null).data[0];
    if(savedir) {
        ExtensionSettingsFilePath = savedir + '/2dActorTools_settings.txt';
        const err = SaveSettings();
        if(err == window.cep.fs.NO_ERROR){
            csInterface.evalScript('$._PPP_.importSettingsFile("' + ExtensionSettingsFilePath + '")');
            $('#setting_file_not_exist_icon').css('visibility','hidden');
            $('#setting_save_modal_close').click();
        } else {
            alert(CEP_ERROR_TO_MESSAGE[err]);
        }
    }
}

function ImportSettingFile() {
    const settingFilePath = window.cep.fs.showOpenDialog(false, false, '2dActorTools setting file', '', ['.txt']).data;
    if(settingFilePath != '') {
        csInterface.evalScript('$._PPP_.importSettingsFile("' + settingFilePath + '")', function(e) {
            LoadSettings();
        });
        $('#setting_file_not_exist_icon').css('visibility','hidden');
        $('#setting_save_modal_close').click();
    }
}

function SaveSettingValueFromElement(jq_target) {
    const value = jq_target.val();
    const category = jq_target.attr('category');
    const id = jq_target.attr('id');
    SettingUpdate(category, id, value);
}

function SaveSettingCheckFromElement(jq_checkbox) {
    let value = 0;
    if(jq_checkbox.prop('checked')) value = 1;		
    const category = jq_checkbox.attr('category');
    const id = jq_checkbox.attr('id');
    SettingUpdate(category, id, value);
}

function SettingUpdate(category, id, value) {
    if(!ExtensionSettings[category]) {
        ExtensionSettings[category] = {};
    }
    ExtensionSettings[category][id] = value;
    SaveSettings();
}

$(document).on('change', '.save_setting_value_on_change', function() {
    SaveSettingValueFromElement($(this));
});
$(document).on('change', '.save_setting_check_on_change', function() {
    SaveSettingCheckFromElement($(this));
});