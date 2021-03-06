#include "./lib/json2.js"

var TIMEDISPLAY_24Timecode				= 100;
var TIMEDISPLAY_25Timecode				= 101;
var TIMEDISPLAY_2997DropTimecode		= 102;
var TIMEDISPLAY_2997NonDropTimecode		= 103;
var TIMEDISPLAY_30Timecode				= 104;
var TIMEDISPLAY_50Timecode				= 105;
var TIMEDISPLAY_5994DropTimecode		= 106;
var TIMEDISPLAY_5994NonDropTimecode		= 107;
var TIMEDISPLAY_60Timecode				= 108;
var TIMEDISPLAY_Frames					= 109;
var TIMEDISPLAY_23976Timecode			= 110;
var TIMEDISPLAY_16mmFeetFrames			= 111;
var TIMEDISPLAY_35mmFeetFrames			= 112;
var TIMEDISPLAY_48Timecode				= 113;
var TIMEDISPLAY_AudioSamplesTimecode	= 200;
var TIMEDISPLAY_AudioMsTimecode			= 201;
 
// field type constants

var FIELDTYPE_Progressive	= 0;
var FIELDTYPE_UpperFirst	= 1;
var FIELDTYPE_LowerFirst	= 2;

// audio channel types

var AUDIOCHANNELTYPE_Mono			= 0;
var AUDIOCHANNELTYPE_Stereo			= 1;
var AUDIOCHANNELTYPE_51				= 2;
var AUDIOCHANNELTYPE_Multichannel	= 3;
var AUDIOCHANNELTYPE_4Channel		= 4;
var AUDIOCHANNELTYPE_8Channel		= 5;
 
// vr projection type

var VRPROJECTIONTYPE_None				= 0;
var VRPROJECTIONTYPE_Equirectangular	= 1;
 
// vr stereoscopic type

var VRSTEREOSCOPICTYPE_Monoscopic		= 0;        
var VRSTEREOSCOPICTYPE_OverUnder		= 1;        
var VRSTEREOSCOPICTYPE_SideBySide		= 2;        

// constants used when clearing cache

var MediaType_VIDEO		= "228CDA18-3625-4d2d-951E-348879E4ED93"; // Magical constants from Premiere Pro's internal automation.
var MediaType_AUDIO		= "80B8E3D5-6DCA-4195-AEFB-CB5F407AB009";
var MediaType_ANY		= "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF";
		
var MediaType_Audio = 0;	// Constants for working with setting value. 
var MediaType_Video = 1;

var NOT_SET = "-400000";

var mylib = new ExternalObject( "lib:\PlugPlugExternalObject" );

var SEQUENCE_LINK_SUCCESS = 0;
var LINKERROR_NO_ACTIVE_SEQUENCE = 1
var LINKERROR_SEQUENCE_NOT_SELECT = 2;
var LINKERROR_SEQUENCE_MULTIPLE_SELECT = 3;
var LINKERROR_SELECT_ITEM_ISNOT_SEQUENCE = 4;
var LINKERROR_UNKNOWN = 5;
var linkSequence = [];

var ACT_CLIPEND_START = 1;
var ACT_CLIPEND_END = 2;
var ACT_CLIPEND_MARKER = 4;

var DummyClipNodeID = 0;
var ActorBinItem;
var propertiesObject = [];

var OperationTargetList = [];
var eventObj = new CSXSEvent();

$._PPP_={

	Setup: function(extPath){
		if (app.project) {
			var projectItems = app.project.rootItem.children;
			var actBinExists = false;
			for(var i = 0; i < projectItems.numItems; i++) {
				if(projectItems[i].type === ProjectItemType.BIN && projectItems[i].name === ACT_BIN) {
					ActorBinItem = projectItems[i];
					actBinExists = true;
					break;
				}
			}
			
			if(!actBinExists) {
				app.project.rootItem.createBin(ACT_BIN);
				for(var i = 0; i < projectItems.numItems; i++) {
					if(projectItems[i].type === ProjectItemType.BIN && projectItems[i].name === ACT_BIN) {
						ActorBinItem = projectItems[i];
						break;
					}
				}
			}
			
			var dummyClip = $._PPP_.shallowSearchClip(ActorBinItem, 'dummy.png');
			if(dummyClip === null) app.project.importFiles([extPath + '/resource/dummy.png'], true, ActorBinItem, false);

			DummyClipNodeID = $._PPP_.shallowSearchClip(ActorBinItem, 'dummy.png').nodeId;
		}
		app.bind('onActiveSequenceStructureChanged', $._PPP_.sequenceStructureChanged);
		app.bind("onSourceClipSelectedInProjectPanel", $._PPP_.reportProjectItemSelectionChanged);
		app.bind('onActiveSequenceSelectionChanged', $._PPP_.reportSequenceItemSelectionChanged)
	},

	sequenceStructureChanged : function () {
		var seq = app.project.activeSequence;
		if(seq) {
			eventObj.type = "numTracksNotification";
			eventObj.data = seq.videoTracks.numTracks.toString() + ',' + seq.audioTracks.numTracks.toString();
			eventObj.dispatch();
		}
	},

	insertSubtitle : function (mgtName, text){
		var mgtBin = $._PPP_.searchForBinWithName(MGT_BIN);
		if(mgtBin){
			var mgtClip = $._PPP_.searchForClipWithName(mgtName, mgtBin);
			var seq = app.project.activeSequence;
			
			if(mgtClip && seq) {
				var VTrackIndex = 0;
				var ATrackIndex = 0;
				for(; VTrackIndex < seq.videoTracks.numTracks; VTrackIndex++) {
					if (seq.videoTracks[VTrackIndex].isTargeted()) break;
				}
				for(; ATrackIndex < seq.audioTracks.numTracks; ATrackIndex++) {
					if (seq.audioTracks[ATrackIndex].isTargeted()) break;
				}
				var outPoint = new Time();
				if (VTrackIndex < seq.videoTracks.numTracks && ATrackIndex < seq.audioTracks.numTracks) {
					var targetVideoTrack = seq.videoTracks[VTrackIndex];
					var targetAudioTrack = seq.audioTracks[ATrackIndex];
					var splitText = text.split('/');

					for (var i = 0; i < targetAudioTrack.clips.numItems; i++) {
						var clip = targetAudioTrack.clips[i];
						outPoint.seconds = clip.outPoint.seconds;
						mgtClip.setOutPoint(outPoint.ticks, 4)
						targetVideoTrack.overwriteClip(mgtClip, clip.start.seconds);							

						var mgtComponent = targetVideoTrack.clips[i].getMGTComponent();
						var sourceText = mgtComponent.properties.getParamForDisplayName(DISPLAY_NAME_SRC_TEXT);
						if(sourceText && i < splitText.length){
							var textObj = JSON.parse(sourceText.getValue());
							textObj.fontTextRunLength = [splitText[i].length];
							textObj.textEditValue = splitText[i];
							sourceText.setValue(JSON.stringify(textObj), (i === targetAudioTrack.clips.numItems - 1)); 
						}
					}
				}
				else {
					$._PPP_.updateEventPanel("Track target is unset.");
				}
			}
			else if(!seq)
				$._PPP_.updateEventPanel("No active sequence.");
			else
				$._PPP_.updateEventPanel(mgtName + " clip is not found.");
		}
	},

	getTragetAudioClipMediaPath: function() {
		var seq = app.project.activeSequence;
		var mediaPathList = [];
		if(seq) {
			for(var i = 0; i < seq.audioTracks.numTracks; i++) {
				if (seq.audioTracks[i].isTargeted()) {
					var clips = seq.audioTracks[i].clips;
					for(var j = 0; j < clips.numItems; j++){
						mediaPathList.push(clips[j].projectItem.getMediaPath());
					}
					break;
				}
			}
		}
		return mediaPathList.join(',');
	},

	getMGTClipName: function () {
		var deepSearchMGT = function (root, clipNames) {
			for (var i = 0; i < root.children.numItems; i++) {
				if (root.children[i]) {
					if (root.children[i].type === ProjectItemType.BIN) {
						deepSearchMGT(root.children[i], clipNames);

					}
					else if (root.children[i].type === ProjectItemType.CLIP) {
						clipNames.push(root.children[i].name);
					}
				}
			}
		};
		var root = $._PPP_.searchForBinWithName(MGT_BIN);
		var clipNames = [];
		if(root) {
			deepSearchMGT(root, clipNames);
		}
		return clipNames;
	},

	captureSelectedClipProperties: function() {
		var seq = app.project.activeSequence;
		var propertiesNames = [];
		if(seq) {
			propertiesObject.splice(0);
			var selected_clips = seq.getSelection();
			if(selected_clips.length > 0) {
				var clip = selected_clips[0];
				for(var i = 0; i < clip.components.numItems; i++) {
					var component = clip.components[i];
					var propertyNames = {componentName: component.displayName, properties : []};
					var propertyObject = {componentName: component.displayName, propertyNames : [], propertyValues: []};
					for(var j = 0; j < component.properties.numItems; j++){
						if(component.properties[j].displayName !== DISPLAY_NAME_SRC_TEXT) {
							propertyNames.properties.push({name:component.properties[j].displayName});
							propertyObject.propertyNames.push(component.properties[j].displayName);
							if(component.properties[j].displayName.indexOf(LABEL_COLOR) !== -1) {
								propertyObject.propertyValues.push(component.properties[j].getColorValue());									
							} else {
								propertyObject.propertyValues.push(component.properties[j].getValue());	
							}
						} else {
							var srcTextNames = {componentName: component.properties[j].displayName, properties : []};
							var srcTextPropertyObject = {componentName: component.properties[j].displayName, propertyNames : [], propertyValues: []};
							var srcTextComponent = JSON.parse(component.properties[j].getValue());						
							for(var p in srcTextComponent) {
								srcTextNames.properties.push({name:p});
								srcTextPropertyObject.propertyNames.push(p);
								srcTextPropertyObject.propertyValues.push(srcTextComponent[p]);
							}
							propertiesNames.push(srcTextNames);
							propertiesObject.push(srcTextPropertyObject);
						}
					}
					propertiesNames.push(propertyNames);
					propertiesObject.push(propertyObject);
				}
			}
		}
		var wrapper = {components:propertiesNames};
		return JSON.stringify(wrapper);
	},

	deployCapturedProperties: function(deployParams) {
		var deployObj = deployParams;
		for(var i = 0; i < deployObj.components.length; i++) {
			var componetName = deployObj.components[i].componentName;
			var properties = deployObj.components[i].properties;
			deployObj.components[i].values = [];
			for(var j = 0; j < propertiesObject.length; j++){
				if(componetName === propertiesObject[j].componentName) {
					var names = propertiesObject[j].propertyNames;
					var values = propertiesObject[j].propertyValues;
					for(var k = 0; k < properties.length; k++) {
						for(var l = 0; l < names.length; l++) {
							if(properties[k] === names[l]) {
								deployObj.components[i].values.push(values[l]);
								break;
							}
						}
					}
					break;
				}
			}
		}

		if(app.project.activeSequence) {
			var selectClips = app.project.activeSequence.getSelection();
			if(selectClips.length) {
				for(var i = 0; i < selectClips.length; i++) {
					var updateUI = (i === selectClips.length - 1);
					var components = selectClips[i].components;
					for(var j = 0; j < deployObj.components.length; j++) {
						var deployComponetName = deployObj.components[j].componentName;
						var deployProperties = deployObj.components[j].properties;
						if(deployComponetName !== DISPLAY_NAME_SRC_TEXT) {
							for(var k = 0; k < components.length; k++) {
								if(components[k].displayName === deployComponetName) {
									var properties = selectClips[i].components[k].properties;
									for(var l = 0; l < deployProperties.length; l++) {
										for(var m = 0; m < properties.length; m++) {
											if(deployProperties[l] === properties[m].displayName) {
												if(properties[m].displayName.indexOf(LABEL_COLOR) !== -1) {
													var color = deployObj.components[j].values[l];
													properties[m].setColorValue(color[0], color[1], color[2], color[3], updateUI);
												} else {
													properties[m].setValue(deployObj.components[j].values[l], updateUI);
												}
												break;
											}
										}
									}
									break;
								}
							}
						} else {
							var mgtComponent =  selectClips[i].getMGTComponent();
							var sourceText = mgtComponent.properties.getParamForDisplayName(DISPLAY_NAME_SRC_TEXT);
							var textObj = JSON.parse(sourceText.getValue());
							for(var k = 0; k < deployProperties.length; k++) {
								textObj[deployProperties[k]] = deployObj.components[j].values[k];
							}							
							sourceText.setValue(JSON.stringify(textObj), updateUI); 
						}
					}
				}
			}
		}
	},

	getActorBinName: function() {
		var actBin = ActorBinItem;
		var binNames = [];
		if(actBin) {
			for( var i = 0; i < actBin.children.numItems; i++) {
				if(actBin.children[i].type === ProjectItemType.BIN) {
					binNames.push(actBin.children[i].name);
				}
			}
		}
		return binNames;
	},

	getActorStructure: function(binName) {
		var deepSearchActStructure = function (root, actorStructure) {
			for (var i = 0; i < root.children.numItems; i++) {
				if (root.children[i]) {
					if (root.children[i].type === ProjectItemType.BIN) {
						deepSearchActStructure(root.children[i], actorStructure);
					}
					else if (root.children[i].type === ProjectItemType.CLIP) {
						var treePath = root.children[i].treePath;
						treePath = treePath.slice(1 + treePath.indexOf('\\', 1 + treePath.indexOf('\\', 1 + treePath.indexOf('\\', 1))));
						actorStructure.push([root.children[i].name, root.name, root.children[i].getMediaPath().replace(/\\/g, '/'), treePath.replace(/\\/g, '/')]);
					}
				}
			}
		};

		var root = $._PPP_.searchForBinWithName(binName, ActorBinItem);
		var actorStructure = [];
		if(root) {
			deepSearchActStructure(root, actorStructure);
		}
		return actorStructure;
	},

	getCurrentActorClipTreePath: function(sequenceIndex, currentTime) {
		if(currentTime < 0) {
			var aseq = app.project.activeSequence;
			if(aseq) {
				currentTime = aseq.getPlayerPosition().seconds;
			}
		}
		var seq = linkSequence[sequenceIndex];
		var treePathList = [];
		if(seq) {
			for(var i = 0; i < seq.videoTracks.numTracks; i++){
				var clips = seq.videoTracks[i].clips;
				if(clips.numItems === 0) {
					treePathList.push('delete');
				} else {
					var j = 0;
					for(; j < clips.numItems; j++) {
						if(currentTime >= clips[j].start.seconds && currentTime < clips[j].end.seconds) {
							var treePath = clips[j].projectItem.treePath;
							treePathList.push(treePath.slice(1 + treePath.indexOf('\\', 1 + treePath.indexOf('\\', 1 + treePath.indexOf('\\', 1)))).replace(/\\/g, '/'));
							break;
						}
					}
					if(j === clips.numItems) {
						treePathList.push('delete');
					}
				}
			}
		}
		return treePathList;
	},

	importMOGRTFile: function(pathList) {
		var seq = app.project.activeSequence;
		if(seq) {
			var vlocked = [];
			var alocked = [];
			for(var i = 0; i < seq.videoTracks.numTracks; i++){
				vlocked.push(seq.videoTracks[i].isLocked());
				seq.videoTracks[i].setLocked(1);
			}
			for(var i = 0; i < seq.audioTracks.numTracks; i++){
				alocked.push(seq.audioTracks[i].isLocked());
				seq.audioTracks[i].setLocked(1);
			}
			var path = pathList.split(',');
			
			for(var i = 0; i < path.length; i++) {
				var newTrackItem = seq.importMGT(path[i], 0, 0, 0);
				newTrackItem.setSelected(true, false);
				newTrackItem.remove(true, true);
			}

			for(var i = 0; i < seq.videoTracks.numTracks; i++){
				if(!vlocked[i]){
					seq.videoTracks[i].setLocked(0);
				}
			}
			for(var i = 0; i < seq.audioTracks.numTracks; i++){
				if(!alocked[i]){
					seq.audioTracks[i].setLocked(0);
				}
			}
		}
	},

	getActorClipWithTreePath: function(actorName, treePath) {
		var actBin = $._PPP_.shallowSearchBin(ActorBinItem, actorName);
		var sepIndex = treePath.indexOf('/', 0);
		var oldIndex = 0;
		while(sepIndex !== -1){
			var binName = treePath.slice(oldIndex, sepIndex);
			actBin = $._PPP_.shallowSearchBin(actBin, binName);
			if(!actBin) return null;
			oldIndex = sepIndex + 1;
			sepIndex = treePath.indexOf('/', sepIndex + 1);
		}
		if(actBin && oldIndex < treePath.length){
			return $._PPP_.shallowSearchClip(actBin, treePath.slice(oldIndex));
		}
		return null;
	},

	getActorStructureMediaPath: function(actorName) {
		var actBin = $._PPP_.shallowSearchBin(ActorBinItem, actorName);
		var mediaPathList = [];
		if(actBin) {
			for(var i = 0; i < actBin.children.numItems; i++) {
				if(actBin.children[i].type === ProjectItemType.FILE) {
					var mediaPath = actBin.children[i].getMediaPath();
					var lastIndex = mediaPath.lastIndexOf(".");
					if(mediaPath.substr(lastIndex + 1) === 'txt'){
						mediaPathList.push(mediaPath);
					}
				}
			}
		}

		if(mediaPathList.length === 0) return '';
		return mediaPathList.join(',');
	},

	getSettingsMediaPath: function() {
		var mediaPath = "";
		if(ActorBinItem) {
			var file = $._PPP_.shallowSearchFile(ActorBinItem, SETTINGS_FILENAME);
			if(file) {
				mediaPath = file.getMediaPath();
			}
		}
		return mediaPath;
	},

	importSettingsFile: function(path) {
		if(ActorBinItem) {
			return app.project.importFiles([path], true, ActorBinItem, false);
		}
		return false;
	},

	setLinkSequence: function(index) {
		var seq = app.project.activeSequence;
		if(seq) {
			var sel = seq.getSelection();
			if (sel && (sel !== "Connection to object lost")){
				if(sel.length === 0) return LINKERROR_SEQUENCE_NOT_SELECT;
				if(sel.length !== 1) return LINKERROR_SEQUENCE_MULTIPLE_SELECT;
				if (sel[0].name !== 'anonymous' && sel[0].projectItem && sel[0].projectItem.isSequence()) {
					for(var i = 0; i < app.project.sequences.numSequences; i++){
						if(sel[0].projectItem.nodeId === app.project.sequences[i].projectItem.nodeId){
							linkSequence[index] = app.project.sequences[i];
							return SEQUENCE_LINK_SUCCESS;
						}
					}
				} else {
					return LINKERROR_SELECT_ITEM_ISNOT_SEQUENCE;
				}
			} else {
				return LINKERROR_UNKNOWN;
			}
		}
		return LINKERROR_NO_ACTIVE_SEQUENCE;
	},

	insertActorClip: function(actorName, sequenceIndex, trackIndex, clipTreePath, startTime, endFlag) {
		if(startTime < 0) {
			var aseq = app.project.activeSequence;
			if(aseq) {
				startTime = aseq.getPlayerPosition().seconds;
			}
		}
		var seq = linkSequence[sequenceIndex];
		var clip = null;
		var deleteInsertClip = false;
		if(clipTreePath === 'delete') {
			clip = $._PPP_.getDummyClip();
			deleteInsertClip = true;
		} else {
			clip = $._PPP_.getActorClipWithTreePath(actorName, clipTreePath);
			if(clip === null) {
				alert('clip not found\n' + actorName + '/' + clipTreePath);
				return;
			}
		}
		if(seq && clip){
			if(trackIndex >= seq.videoTracks.numTracks) {
				var vlocked = [];
				for(var i = 0; i < seq.videoTracks.numTracks; i++){
					vlocked.push(seq.videoTracks[i].isLocked());
					seq.videoTracks[i].setLocked(1);
				}
				var currentTrackNum = seq.videoTracks.numTracks;
				for(var i = trackIndex - currentTrackNum; i >= 0; i--) {
					seq.videoTracks[seq.videoTracks.numTracks - 1].overwriteClip(clip, startTime);
					seq.videoTracks[seq.videoTracks.numTracks - 1].setLocked(1);
				}
				for(var i = Number(currentTrackNum); i < seq.videoTracks.numTracks; i++) {
					seq.videoTracks[i].setLocked(0);
					seq.videoTracks[i].clips[0].setSelected(true, false);
					seq.videoTracks[i].clips[0].remove(false, false);
				}

				for(var i = 0; i < currentTrackNum; i++){
					if(!vlocked[i]){
						seq.videoTracks[i].setLocked(0);
					}
				}
			}

			var track = seq.videoTracks[trackIndex];
			if(!track.isLocked()){
				var clips = track.clips;
				var epsTime = seq.getSettings().videoFrameRate.seconds;
				var endTime = startTime + 60 * 60;
				if(seq.getOutPointAsTime().seconds > 0) {
					endTime = seq.getOutPointAsTime().seconds;
				}
				var i = clips.numItems - 1;
				if(endFlag & ACT_CLIPEND_END) {
					for(; i >= 0 ; i--){
						if(startTime < clips[i].end.seconds ) {
							endTime = Math.min(endTime, clips[i].end.seconds);
						} else {
							i = Math.min(i + 1, clips.numItems - 1);
							break;
						}
					}
				}
				if(endFlag & ACT_CLIPEND_START) {
					for(; i >= 0 ; i--){
						if(startTime < clips[i].start.seconds) {
							endTime = Math.min(endTime, clips[i].start.seconds);
						} else {
							break;
						}
					}
				}

				if(endFlag & ACT_CLIPEND_MARKER) {
					for(var j = seq.markers.numMarkers - 1; j >= 0 ; j--){
						if(startTime < seq.markers[j].start.seconds) {
							if(startTime < seq.markers[j].start.seconds) {
								endTime = Math.min(endTime, seq.markers[j].start.seconds);
							} else {
								break;
							}
						}
						if(seq.markers[j].end.seconds < startTime) {
							if(startTime < seq.markers[j].end.seconds) {
								endTime = Math.min(endTime, seq.markers[j].end.seconds);
							} else {
								break;
							}
						}
					}
				}

				var duration = new Time();
				duration.seconds = $._PPP_.fixTimeError(endTime - startTime, epsTime);
				clip.setOverrideFrameRate(1/epsTime);
				clip.setOutPoint(duration.ticks, 4);
				track.overwriteClip(clip, startTime);
				clip.setOverrideFrameRate(0);

				if(deleteInsertClip) {
					var serchIndex = Math.min(i + 1, track.clips.numItems - 1);
					if(endFlag & ACT_CLIPEND_MARKER) {
						serchIndex = track.clips.numItems - 1;
					}
					for(var j = serchIndex; j >= 0 ; j--){
						if(track.clips[j].projectItem.nodeId === DummyClipNodeID) {
							track.clips[j].setSelected(true, false);
							track.clips[j].remove(false, false);
						}
					}
				}
			}
		}
	},

	shallowSearchBin: function(root, name) {
		for(var i = 0; i < root.children.numItems; i++) {
			if(root.children[i].type === ProjectItemType.BIN && root.children[i].name === name) {
				return root.children[i];
			}
		}
		return null;
	},

	shallowSearchClip: function(root, name) {
		for(var i = 0; i < root.children.numItems; i++) {
			if(root.children[i].type === ProjectItemType.CLIP && root.children[i].name === name) {
				return root.children[i];
			}
		}
		return null;
	},

	shallowSearchFile: function(root, name) {
		for(var i = 0; i < root.children.numItems; i++) {
			if(root.children[i].type === ProjectItemType.FILE && root.children[i].name === name) {
				return root.children[i];
			}
		}
		return null;
	},

	nextEditPoint: function() {
		var seq = app.project.activeSequence;
		if(seq) {
			var currentPlayerPos = seq.getPlayerPosition();
			currentPlayerPos.seconds += seq.getSettings().videoFrameRate.seconds * 0.9;
			var minSeconds = Number.MAX_VALUE;
			for(var i = 0; i < seq.videoTracks.numTracks; i++) {
				if(seq.videoTracks[i].isTargeted()) {
					var targetTrack = seq.videoTracks[i];
					for(var j = 0; j < targetTrack.clips.numItems; j++){
						if(currentPlayerPos.seconds < targetTrack.clips[j].start.seconds) {
							minSeconds = Math.min(minSeconds, targetTrack.clips[j].start.seconds);
							break;
						}
						if(currentPlayerPos.seconds < targetTrack.clips[j].end.seconds) {
							minSeconds = Math.min(minSeconds, targetTrack.clips[j].end.seconds);
							break;
						}
					}
				}
			}
			for(var i = 0; i < seq.audioTracks.numTracks; i++) {
				if(seq.audioTracks[i].isTargeted()) {
					var targetTrack = seq.audioTracks[i];
					for(var j = 0; j < targetTrack.clips.numItems; j++){
						if(currentPlayerPos.seconds < targetTrack.clips[j].start.seconds) {
							minSeconds = Math.min(minSeconds, targetTrack.clips[j].start.seconds);
							break;
						}
						if(currentPlayerPos.seconds < targetTrack.clips[j].end.seconds) {
							minSeconds = Math.min(minSeconds, targetTrack.clips[j].end.seconds);
							break;
						}
					}
				}
			}
			var epsTime = seq.getSettings().videoFrameRate.seconds;
			currentPlayerPos.seconds = $._PPP_.fixTimeError(minSeconds, epsTime);
			seq.setPlayerPosition(currentPlayerPos.ticks);
		}
	},

	prevEditPoint: function() {
		var seq = app.project.activeSequence;
		if(seq) {
			var currentPlayerPos = seq.getPlayerPosition();
			currentPlayerPos.seconds -= seq.getSettings().videoFrameRate.seconds * 0.9;
			var maxSeconds = 0;
			for(var i = 0; i < seq.videoTracks.numTracks; i++) {
				if(seq.videoTracks[i].isTargeted()) {
					var targetTrack = seq.videoTracks[i];
					for(var j = targetTrack.clips.numItems - 1; j >= 0; j--){
						if(currentPlayerPos.seconds > targetTrack.clips[j].end.seconds) {
							maxSeconds = Math.max(maxSeconds, targetTrack.clips[j].end.seconds);
							break;
						}
						if(currentPlayerPos.seconds > targetTrack.clips[j].start.seconds) {
							maxSeconds = Math.max(maxSeconds, targetTrack.clips[j].start.seconds);
							break;
						}

					}
				}
			}
			for(var i = 0; i < seq.audioTracks.numTracks; i++) {
				if(seq.audioTracks[i].isTargeted()) {
					var targetTrack = seq.audioTracks[i];
					for(var j = targetTrack.clips.numItems - 1; j >= 0; j--){
						if(currentPlayerPos.seconds > targetTrack.clips[j].end.seconds) {
							maxSeconds = Math.max(maxSeconds, targetTrack.clips[j].end.seconds);
							break;
						}
						if(currentPlayerPos.seconds > targetTrack.clips[j].start.seconds) {
							maxSeconds = Math.max(maxSeconds, targetTrack.clips[j].start.seconds);
							break;
						}

					}
				}
			}

			var epsTime = seq.getSettings().videoFrameRate.seconds;
			currentPlayerPos.seconds = $._PPP_.fixTimeError(maxSeconds, epsTime);
			seq.setPlayerPosition(currentPlayerPos.ticks);
		}
	},

	createActorSequence: function(actorName, baseClipTreePath) {
		var seqName	= prompt('Name of sequence?', actorName, 'Sequence Naming Prompt');
		if(seqName !== 'null') {
			var clip = $._PPP_.getActorClipWithTreePath(actorName, baseClipTreePath);
			app.project.createNewSequenceFromClips(seqName, [clip], app.project.rootItem);
		}
	},

	getDummyClip: function() {
		return $._PPP_.shallowSearchClip(ActorBinItem, 'dummy.png');
	},

	keepPanelLoaded : function () {
		app.setExtensionPersistent("com.mochi.2dActorTools", 0);
	},

	searchForBinWithName : function (nameToFind, root) {
		// deep-search a folder by name in project
		var deepSearchBin = function (inFolder) {
			if (inFolder && inFolder.name === nameToFind && inFolder.type === 2) {
				return inFolder;
			} else {
				for (var i = 0; i < inFolder.children.numItems; i++) {
					if (inFolder.children[i] && inFolder.children[i].type === 2) {
						var foundBin = deepSearchBin(inFolder.children[i]);
						if (foundBin) {
							return foundBin;
						}
					}
				}
			}
		};
		if(root)
			return deepSearchBin(root);
		else
			return deepSearchBin(app.project.rootItem);
	},

	searchForClipWithName: function (nameToFind, root) {
		var deepSearchClip = function (root, nameToFind) {
			for (var i = 0; i < root.children.numItems; i++) {
				if (root.children[i]) {
					if (root.children[i].type === ProjectItemType.BIN) {
						var foundClip = deepSearchClip(root.children[i], nameToFind);
						if (foundClip) {
							return foundClip;
						}
					}
					else if (root.children[i].type === ProjectItemType.CLIP && root.children[i].name === nameToFind) {
						return root.children[i];
					}
				}
			}
			return false;
		};
		return deepSearchClip(root, nameToFind);
	},

	searchForBinWithTreePath : function (treePath, root) {
		var sepIndex = treePath.indexOf('/', 0);
		var oldIndex = 0;
		while(sepIndex !== -1){
			var binName = treePath.slice(oldIndex, sepIndex);
			root = $._PPP_.shallowSearchBin(root, binName);
			if(!root) return null;
			oldIndex = sepIndex + 1;
			sepIndex = treePath.indexOf('/', sepIndex + 1);
		}
		if(root && oldIndex < treePath.length){
			return $._PPP_.shallowSearchBin(root, treePath.slice(oldIndex));
		}
		return null;
	},

	searchForClipWithTreePath : function (treePath, root) {
		var sepIndex = treePath.indexOf('/', 0);
		var oldIndex = 0;
		while(sepIndex !== -1){
			var binName = treePath.slice(oldIndex, sepIndex);
			root = $._PPP_.shallowSearchBin(root, binName);
			if(!root) return null;
			oldIndex = sepIndex + 1;
			sepIndex = treePath.indexOf('/', sepIndex + 1);
		}
		if(root && oldIndex < treePath.length){
			return $._PPP_.shallowSearchClip(root, treePath.slice(oldIndex));
		}
		return null;
	},

	importActorStructureFile : function (path, actName) {
		if (app.project && path) {
			var insertBin = $._PPP_.shallowSearchBin(ActorBinItem, actName);
			return app.project.importFiles([path], true, insertBin, false);
		}
	},

	importFiles : function (path, trackIndex, importBinTreePath) {
		var pathList = path.split('\\');
		var trackIndexList = trackIndex.split('\\');
		var binTreePathList = importBinTreePath.split('\\');
		var length = binTreePathList.length;
		var importSet = {};
		
		for(var i = 0; i < length; i++) {
			if(!importSet[binTreePathList[i]]) {
				importSet[binTreePathList[i]] = [];
			}
			importSet[binTreePathList[i]].push(pathList[i]);
		}
		for(var key in importSet) {
			var importBin = $._PPP_.searchForBinWithTreePath(key, app.project.rootItem);
			if(importBin) {
				app.project.importFiles(importSet[key], true, importBin, false);
			}
		}

		var seq = app.project.activeSequence;
		if(seq) {
			length = pathList.length;
			for(var i = 0; i < length; i++) {
				var targetTrackIndex = trackIndexList[i];
				if(trackIndexList[i] >= 0) {
					var targetPath = pathList[i];
					var importBin = $._PPP_.searchForBinWithTreePath(binTreePathList[i], app.project.rootItem);
					var clipName = targetPath.slice(targetPath.lastIndexOf('/') + 1);
					var projectItem = $._PPP_.shallowSearchClip(importBin, clipName);
					var targetAudioTrack = seq.audioTracks[targetTrackIndex];
					targetAudioTrack.overwriteClip(projectItem, seq.getPlayerPosition().seconds);
					for (var j = 0; j < targetAudioTrack.clips.numItems; j++) {
						var clip = targetAudioTrack.clips[j];
						if(clip.projectItem.nodeId == projectItem.nodeId) {
							seq.setPlayerPosition(clip.end.ticks);
							break;
						}
					}
				}
			}
		}
	},

	fixTimeError : function(seconds, epsTime) {
		var mod = (seconds % epsTime);
		if(mod * 2 < epsTime) {
			seconds -= mod;
		} else {
			seconds += epsTime - mod;
		}
		return seconds;
	},

	AutoNewLine_GetSourceText : function() {
		OperationTargetList = [];
		var seq = app.project.activeSequence;
		var textList = [];
		if(seq) {
			var selected_clips = seq.getSelection();
			if(selected_clips.length > 0) {
				var length = selected_clips.length;
				for(var i = 0; i < length; i++) {
					var mgtComponent = selected_clips[i].getMGTComponent();
					if(mgtComponent) {
						var sourceText = mgtComponent.properties.getParamForDisplayName(DISPLAY_NAME_SRC_TEXT);
						if(sourceText){
							var textObj = JSON.parse(sourceText.getValue());
							textList.push(textObj.textEditValue);
							OperationTargetList.push(selected_clips[i]);
						}
					}
				}
			} else{
				for(var trackIndex = 0; trackIndex < seq.videoTracks.numTracks; trackIndex++) {
					if (seq.videoTracks[trackIndex].isTargeted()) {
						var clips = seq.videoTracks[trackIndex].clips;
						var length = clips.numItems;
						for(var i = 0; i < length; i++){
							var mgtComponent = clips[i].getMGTComponent();
							if(mgtComponent) {
								var sourceText = mgtComponent.properties.getParamForDisplayName(DISPLAY_NAME_SRC_TEXT);
								if(sourceText){
									var textObj = JSON.parse(sourceText.getValue());
									textList.push(textObj.textEditValue);
									OperationTargetList.push(clips[i]);
								}
							}
						}
					}
				}
			}
		}
		return textList.join('/');
	},

	AutoNewLine_Replace : function(textList, markerColorIndex) {
		var _textList = textList.split('/');
		var _markerColorIndex = markerColorIndex.split('/');
		var length = OperationTargetList.length;
		var seq = app.project.activeSequence;
		if(seq) {
			var markers = seq.markers;
			var epsTime = seq.getSettings().videoFrameRate.seconds;
			for(var i = 0; i < length; i++){
				var sourceText = OperationTargetList[i].getMGTComponent().properties.getParamForDisplayName(DISPLAY_NAME_SRC_TEXT);
				if(sourceText) {
					var textObj = JSON.parse(sourceText.getValue());
					textObj.fontTextRunLength = [_textList[i].length];
					textObj.textEditValue = _textList[i];
					sourceText.setValue(JSON.stringify(textObj), (i === length - 1)); 
				}
				if(_markerColorIndex[i] !== '-1') {
					var clipTime = OperationTargetList[i].start.seconds;
					clipTime = $._PPP_.fixTimeError(clipTime, epsTime);
					var marker = markers.createMarker(clipTime);
					marker.setColorByIndex(Number(_markerColorIndex[i]));
					marker.comments = _textList[i];
				}
			}
		}
	},

	GetSelectedClipText : function() {
		var seq = app.project.activeSequence;
		var text = '';
		if(seq) {
			var selected_clips = seq.getSelection();
			if(selected_clips.length > 0) {
				var mgtComponent = selected_clips[0].getMGTComponent();
				if(mgtComponent) {
					var sourceText = mgtComponent.properties.getParamForDisplayName(DISPLAY_NAME_SRC_TEXT);
					if(sourceText){
						var textObj = JSON.parse(sourceText.getValue());
						text = textObj.textEditValue;
					}
				}
			}
		}
		return text;
	},

	getSelectedBinTreePath : function() {
		var treePath = app.project.getInsertionBin().treePath;
		var index = treePath.indexOf('\\', 1);
		if(index > 0) {
			treePath = treePath.slice(treePath.indexOf('\\', 1) + 1).replace(/\\/g, '/');
			return treePath;
		}
		return '';
	},

	existBinTreePath : function(treePath) {
		if($._PPP_.searchForBinWithTreePath(treePath, app.project.rootItem)) {
			return true;
		}
		return '';
	},
	
	existClipTreePath : function(treePath) {
		if($._PPP_.searchForClipWithTreePath(treePath, app.project.rootItem)) {
			return true;
		}
		return '';
	},

	reportProjectItemSelectionChanged : function (e) { // Note: This message is also triggered when the user opens or creates a new project. 
		var projectItems = e;
		if (projectItems){
			if (projectItems.length) {
				eventObj.type = "projectItemsSelect";
				eventObj.data = projectItems[0].treePath.slice(projectItems[0].treePath.indexOf('\\', 1) + 1).replace(/\\/g, '/');
				eventObj.dispatch();
			}
		}
	},

	reportSequenceItemSelectionChanged : function () {
		eventObj.type = "sequenceItemsSelectChanged";
		eventObj.data = '';
		eventObj.dispatch();
	},

	getSelectedSequenceTrackNum : function() {
		var seq = app.project.activeSequence;
		if(seq) {
			var selection = seq.getSelection();
			if(selection.length) {
				if(selection[0].projectItem.isSequence) {
					var targetSequence = selection[0];
					for(var i = 0; i < app.project.sequences.numSequences; i++){
						if(targetSequence.projectItem.nodeId === app.project.sequences[i].projectItem.nodeId){
							return app.project.sequences[i].videoTracks.numTracks.toString() + ',' + app.project.sequences[i].audioTracks.numTracks.toString();
						}
					}
				}
			}
		}
		return '';
	},

	triggerClipOverwrite : function(targetSeqFlag, trackIndex, startClipTreePath, endClipTreePath, startTriggerInsertFlag, endTriggerInsertFlag) {
		var seq = app.project.activeSequence;
		var activeSeq = app.project.activeSequence;
		if(targetSeqFlag == 0) {
			if(seq) {
				var selection = seq.getSelection();
				seq = null;
				if(selection.length) {
					if(selection[0].projectItem.isSequence) {
						var targetSequence = selection[0];
						for(var i = 0; i < app.project.sequences.numSequences; i++){
							if(targetSequence.projectItem.nodeId === app.project.sequences[i].projectItem.nodeId){
								seq = app.project.sequences[i];
								break;
							}
						}
					}
				}
			}
		}
		if(seq && activeSeq) {
			if(trackIndex >= seq.videoTracks.numTracks) return;
			var targetTrack = seq.videoTracks[trackIndex];
			var epsTime = seq.getSettings().videoFrameRate.seconds;
			var startClip = $._PPP_.searchForClipWithTreePath(startClipTreePath, app.project.rootItem);
			var endClip = $._PPP_.searchForClipWithTreePath(endClipTreePath, app.project.rootItem);

			var ATrackIndex = 0;
			for(; ATrackIndex < activeSeq.audioTracks.numTracks; ATrackIndex++) {
				if (activeSeq.audioTracks[ATrackIndex].isTargeted()) break;
			}
			if (ATrackIndex < activeSeq.audioTracks.numTracks) {
				var sourceAudioTrack = activeSeq.audioTracks[ATrackIndex];
				if(startClip) {
					startClip.setOverrideFrameRate(1 / epsTime);
				}
				if(endClip) {
					endClip.setOverrideFrameRate(1 / epsTime);
				}
				for (var sourceClipIndex = 0; sourceClipIndex < sourceAudioTrack.clips.numItems; sourceClipIndex++) {
					var sourceAudioClip = sourceAudioTrack.clips[sourceClipIndex];
					if(startClip) {
						var clips = targetTrack.clips;
						var endFlag = startTriggerInsertFlag;
						var startTime = sourceAudioClip.start.seconds;
						var endTime = startTime + 60 * 60;
						if(seq.getOutPointAsTime().seconds > 0) {
							endTime = seq.getOutPointAsTime().seconds;
						}
						var i = clips.numItems - 1;
						if(endFlag & ACT_CLIPEND_END) {
							for(; i >= 0 ; i--){
								if(startTime < clips[i].end.seconds ) {
									endTime = Math.min(endTime, clips[i].end.seconds);
								} else {
									i = Math.min(i + 1, clips.numItems - 1);
									break;
								}
							}
						}
						if(endFlag & ACT_CLIPEND_START) {
							for(; i >= 0 ; i--){
								if(startTime < clips[i].start.seconds) {
									endTime = Math.min(endTime, clips[i].start.seconds);
								} else {
									break;
								}
							}
						}
		
						if(endFlag & ACT_CLIPEND_MARKER) {
							for(var j = seq.markers.numMarkers - 1; j >= 0 ; j--){
								if(startTime < seq.markers[j].start.seconds) {
									if(startTime < seq.markers[j].start.seconds) {
										endTime = Math.min(endTime, seq.markers[j].start.seconds);
									} else {
										break;
									}
								}
								if(seq.markers[j].end.seconds < startTime) {
									if(startTime < seq.markers[j].end.seconds) {
										endTime = Math.min(endTime, seq.markers[j].end.seconds);
									} else {
										break;
									}
								}
							}
						}
						var duration = new Time();
						duration.seconds = $._PPP_.fixTimeError(endTime - startTime, epsTime);
						startClip.setOutPoint(duration.ticks, 4);
						targetTrack.overwriteClip(startClip, startTime);
					}
					if(endClip) {
						var clips = targetTrack.clips;
						var endFlag = endTriggerInsertFlag;
						var startTime = sourceAudioClip.end.seconds;
						var endTime = startTime + 60 * 60;
						if(seq.getOutPointAsTime().seconds > 0) {
							endTime = seq.getOutPointAsTime().seconds;
						}
						var i = clips.numItems - 1;
						if(endFlag & ACT_CLIPEND_END) {
							for(; i >= 0 ; i--){
								if(startTime < clips[i].end.seconds ) {
									endTime = Math.min(endTime, clips[i].end.seconds);
								} else {
									i = Math.min(i + 1, clips.numItems - 1);
									break;
								}
							}
						}
						if(endFlag & ACT_CLIPEND_START) {
							for(; i >= 0 ; i--){
								if(startTime < clips[i].start.seconds) {
									endTime = Math.min(endTime, clips[i].start.seconds);
								} else {
									break;
								}
							}
						}
		
						if(endFlag & ACT_CLIPEND_MARKER) {
							for(var j = seq.markers.numMarkers - 1; j >= 0 ; j--){
								if(startTime < seq.markers[j].start.seconds) {
									if(startTime < seq.markers[j].start.seconds) {
										endTime = Math.min(endTime, seq.markers[j].start.seconds);
									} else {
										break;
									}
								}
								if(seq.markers[j].end.seconds < startTime) {
									if(startTime < seq.markers[j].end.seconds) {
										endTime = Math.min(endTime, seq.markers[j].end.seconds);
									} else {
										break;
									}
								}
							}
						}
						var duration = new Time();
						duration.seconds = $._PPP_.fixTimeError(endTime - startTime, epsTime);
						endClip.setOutPoint(duration.ticks, 4);
						targetTrack.overwriteClip(endClip, startTime);
					}
				}
				if(startClip) {
					startClip.setOverrideFrameRate(0);
				}
				if(endClip) {
					endClip.setOverrideFrameRate(0);
				}
			}
		}
	},

	updateEventPanel : function (message) {
		app.setSDKEventMessage(message, 'info');
		//app.setSDKEventMessage('Here is a warning.', 'warning');
		//app.setSDKEventMessage('Here is an error.', 'error');  // Very annoying; use sparingly.
	},

	setLocale : function (localeFromCEP) {
		$.locale = localeFromCEP;
	},
};
