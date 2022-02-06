/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */

function onLoaded () {

	loadJSX();


}

/**
* Load JSX file into the scripting context of the product. All the jsx files in 
* folder [ExtensionRoot]/jsx & [ExtensionRoot]/jsx/[AppName] will be loaded.
*/
function loadJSX() {
	var csInterface = new CSInterface();

	// get the appName of the currently used app. For Premiere Pro it's "PPRO"
	var appName = csInterface.hostEnvironment.appName;
	var extensionPath = csInterface.getSystemPath(SystemPath.EXTENSION);

	// load general JSX script independent of appName
	var extensionRootGeneral = extensionPath + "/jsx/";
	csInterface.evalScript("$._ext.evalFiles(\"" + extensionRootGeneral + "\")", function(){

		// load JSX scripts based on appName
		var extensionRootApp = extensionPath + "/jsx/" + appName + "/";
		csInterface.evalScript("$._ext.evalFiles(\"" + extensionRootApp + "\")", function(){
			var csInterface = new CSInterface();
			
			// Good idea from our friends at Evolphin; make the ExtendScript locale match the JavaScript locale!
			// var prefix		= "$._PPP_.setLocale('";
			// var locale	 	= csInterface.hostEnvironment.appUILocale;
			// var postfix		= "');";
			
			var entireCallWithParams = makeEvalScript('setLocale', csInterface.hostEnvironment.appUILocale);
			csInterface.evalScript(entireCallWithParams, function(){
				loadSetup();
			});
		});
	});
}

function evalScript(script, callback) {
	new CSInterface().evalScript(script, callback);
}
