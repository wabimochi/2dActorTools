
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
    csInterface.evalScript('$._PPP_.captureSelectedClipProperties()', function(propertiesNames) {
        $('#capturedParameters').empty();
        const obj = JSON.parse(propertiesNames);
        for(let i = 0; i < obj.components.length; i++) {
            const componentName = $('<details>', {'class':'propertyDeploy', open:true});
            const summary = $('<summary>');
                summary.html(obj.components[i].componentName);
            componentName.append(summary);
            const properties = obj.components[i].properties;
            for(let j = 0; j < properties.length; j++) {
                if(properties[j].name !== ' ' && properties[j].name !== 'textEditValue' &&  properties[j].name !== 'fontTextRunLength') {
                    const grid = $('<div>', {'class':'uk-flex uk-text-left uk-padding-remove-left uk-grid uk-grid-stack uk-margin-remove-top deploy_property_select', 'uk-grid':''});
                    const icon = $('<div>', {'class':'uk-padding-remove-left uk-icon', 'uk-icon': 'icon: check'})
                    const prop = $('<div>', {'class':'uk-padding-remove-left uk-width-expand property_name'});
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
    const componentList = [];
    const capturedParameters = $('#capturedParameters>.propertyDeploy');
    for(let i = 0; i < capturedParameters.length; i++){
        const component = capturedParameters.eq(i);
        const propertyNames = {componentName: component.children('summary').html(), properties : []};
        const properties = component.children('.deploy_property_select');
        for(let j = 0; j < properties.length; j++) {
            if(properties.eq(j).children('.property_name').hasClass('enable')) {
                propertyNames.properties.push(properties.eq(j).children('.property_name').html());
            }
        }
        componentList.push(propertyNames);
    }
    const wrapper = {components:componentList};

    csInterface.evalScript('$._PPP_.deployCapturedProperties(' + JSON.stringify(wrapper) + ')');
}