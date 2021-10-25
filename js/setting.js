const E_SETTING_version = 'version';
const E_SETTING_ui_params = 'uiparams';
const E_SETTING_actors = 'actors';

let ExtensionSettings = {};
let ExtensionSettingsFilePath = null;
let loadSettingsTimeoutId = null;
let retryLoadingCount = 0;

function SaveSettings() {
    settingSaveTimeoutHandle = null;
    if(ExtensionSettingsFilePath) {
        return SaveJson(ExtensionSettings, ExtensionSettingsFilePath);
    }
}

function LoadSettings()	{
    if(loadSettingsTimeoutId != null) {
        clearTimeout(loadSettingsTimeoutId);
    }
    loadSettingsTimeoutId = setTimeout(_LoadSettings, 500);
}

function _LoadSettings() {
    csInterface.evalScript('$._PPP_.GetSettingsMediaPath()', function(result){
        if(result) {
            const json = window.cep.fs.readFile(result);
            if(json.err){
                $('#setting_file_not_exist_icon').css('display','inherit');
                if(json.err != window.cep.fs.ERR_NOT_FOUND) {
                    alert(CEP_ERROR_TO_MESSAGE[json.err]);
                }
            } else {
                $('#setting_file_not_exist_icon').css('display','none');
                ExtensionSettingsFilePath = result;
                ExtensionSettings = ExtensionSettingsVersionConvert(JSON.parse(json.data));
                ApplySettings();
            }
        } else {
            $('#setting_file_not_exist_icon').css('display','inherit');
        }
        actorSelectBoxUpdate();
    });
}

function ExtensionSettingsVersionConvert(settings){
    if(!settings[E_SETTING_version]){
        settings = _ExtensionSettingsVersionConvert1(settings);
    }
    return settings;
}

function _ExtensionSettingsVersionConvert1(settings){
    const new_settings = {}
    new_settings[E_SETTING_ui_params] = {};
    for(key in settings){
        new_settings[E_SETTING_ui_params][key] = settings[key];
    }
    new_settings[E_SETTING_version] = 1;
    new_settings[E_SETTING_actors] = {};
    return new_settings;
}

function ApplySettings() {
    const ui_params = ExtensionSettings[E_SETTING_ui_params];
    for(category in ui_params) {
        const setting = ui_params[category];
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
            csInterface.evalScript('$._PPP_.ImportSettingsFile("' + ExtensionSettingsFilePath + '")');
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
        csInterface.evalScript('$._PPP_.ImportSettingsFile("' + settingFilePath + '")', function(e) {
            _LoadSettings();
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

let settingSaveTimeoutHandle = null;
function SettingUpdate(category, id, value) {
    if(settingSaveTimeoutHandle !== null) {
        clearTimeout(settingSaveTimeoutHandle);
        settingSaveTimeoutHandle = null;
    }
    const ui_params = ExtensionSettings[E_SETTING_ui_params];
    
    if(!ui_params[category]) {
        ui_params[category] = {};
    }
    if(ui_params[category][id] !== value){
        ui_params[category][id] = value;
        settingSaveTimeoutHandle = setTimeout(SaveSettings, 3000);
    }
}

function GetUIParams(category){
    return ExtensionSettings[E_SETTING_ui_params][category];
}

function GetActorsHistory(){
    const names = [];
    const actors = ExtensionSettings[E_SETTING_actors];
    for(name in actors){
        names.push(name);
    }
    return names;
}

function GetActorSettingPath(actorName){
    let path = '';
    if(ExtensionSettings[E_SETTING_actors][actorName]){
        path = ExtensionSettings[E_SETTING_actors][actorName];
    }
    return path;
}

function SetActorSettingPath(actorName, settingFilePath){
    if(!ExtensionSettings[E_SETTING_actors][actorName] || ExtensionSettings[E_SETTING_actors][actorName] !== settingFilePath){
        ExtensionSettings[E_SETTING_actors][actorName] = settingFilePath;
        SaveSettings();
    }
}

$(document).on('change', '.save_setting_value_on_change', function() {
    SaveSettingValueFromElement($(this));
});
$(document).on('change', '.save_setting_check_on_change', function() {
    SaveSettingCheckFromElement($(this));
});