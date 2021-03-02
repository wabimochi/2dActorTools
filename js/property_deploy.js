
$(document).on('click', '.propertyDeploy>div>div', function(e){
    if($(this).hasClass('enable')) {
        if(e.shiftKey) {
            $(this).parents('details').find('div').removeClass('enable');
        } else {
            $(this).removeClass('enable');
            $(this).siblings().removeClass('enable');
        }
    } else {
        if(e.shiftKey) {
            $(this).parents('details').find('div').addClass('enable');
        } else {
            $(this).siblings().addClass('enable');
            $(this).addClass('enable');
        }
    }
});

function propertyCapture() {
    var csInterface = new CSInterface();
    csInterface.evalScript('$._PPP_.captureSelectedClipProperties()', function(propertiesNames) {
        $('#capturedParameters').empty();
        var obj = JSON.parse(propertiesNames);
        for(let i = 0; i < obj.components.length; i++) {
            var componentName = $('<details>', {'class':'propertyDeploy', open:true});
            var summary = $('<summary>');
                summary.html(obj.components[i].componentName);
            componentName.append(summary);
            const properties = obj.components[i].properties;
            for(let j = 0; j < properties.length; j++) {
                if(properties[j].name !== ' ' && properties[j].name !== 'textEditValue' &&  properties[j].name !== 'fontTextRunLength') {
                    var grid = $('<div>', {'class':'uk-flex uk-text-left uk-padding-remove-left uk-grid uk-grid-stack uk-margin-remove-top deploy_property_select', 'uk-grid':''});
                    var icon = $('<div>', {'class':'uk-padding-remove-left uk-icon', 'uk-icon': 'icon: check'})
                    var prop = $('<div>', {'class':'uk-padding-remove-left uk-width-expand property_name'});
                        prop.html(properties[j].name);
                    grid.append(icon);
                    grid.append(prop);
                    componentName.append(grid);
                }
            }
            $('#capturedParameters').append(componentName);
        }
    });
}

function propertyDeploy() {
    let componentList = [];
    let capturedParameters = $('#capturedParameters>.propertyDeploy');
    for(let i = 0; i < capturedParameters.length; i++){
        const component = capturedParameters.eq(i);
        var propertyNames = {componentName: component.children('summary').html(), properties : []};
        let properties = component.children('.deploy_property_select');
        for(let j = 0; j < properties.length; j++) {
            if(properties.eq(j).children('.property_name').hasClass('enable')) {
                propertyNames.properties.push(properties.eq(j).children('.property_name').html());
            }
        }
        componentList.push(propertyNames);
    }
    let wrapper = {components:componentList};

    var csInterface = new CSInterface();
    csInterface.evalScript('$._PPP_.deployCapturedProperties(' + JSON.stringify(wrapper) + ')');
}