#include "./lib/json2.js";

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

var ANIMATION_SEQUENCE_LINK_MARKER_COLOR = 5;
var TRANSITION_MARKER_NAME = 'animation';

var mylib = new ExternalObject( "lib:\PlugPlugExternalObject" );

var SEQUENCE_LINK_SUCCESS = 0;
var LINKERROR_NO_ACTIVE_SEQUENCE = 1
var LINKERROR_SEQUENCE_NOT_SELECT = 2;
var LINKERROR_SEQUENCE_MULTIPLE_SELECT = 3;
var LINKERROR_SELECT_ITEM_ISNOT_SEQUENCE = 4;
var LINKERROR_UNKNOWN = 5;
var linkSequence = [];
var linkSequenceParents = [];
var linkAnimationSequence = [];
var linkAnimationProperties = [];

var ACT_CLIPEND_START = 1;
var ACT_CLIPEND_END = 2;
var ACT_CLIPEND_MARKER = 4;

var DummyClipNodeID = 0;
var ActorBinItem;
var propertiesObject = [];

var OperationTargetList = [];
var eventObj = new CSXSEvent();

var fAnimationSourceClips = null;
var fAnimationSourceClipsLength = 0;
var fAnimationSequence = null;
var fAnimationKeypoints = null;
var fAnimationStartTime = null;
var fLinkedSequenceIndex = -1;
var fAnimationSequenceIndex = -1;
var fAnimationSourceIndex = -1;

var fAnimationSourceCount = 0;
var AnimationProperties = null;
var bakeAllDuration = false;
var bakeAudio_ID = null;
var projectSelectionItem = null;

var ANIMATION_LINK_INFO_PARENT_SEQUENCE_ID = 0;
var ANIMATION_LINK_INFO_TRACK_INDEX = 1;
var ANIMATION_LINK_INFO_BBOX = 2;

var FrameAnimationKey = function(index, duration) {
    this.index = index;
    this.duration = duration;
}

$._PPP_={
	Setup: function(extPath){
		initializeActBin(extPath);
		
		DummyClipNodeID =  getDummyClip().nodeId;

		app.unbind('onActiveSequenceStructureChanged');
		app.bind('onActiveSequenceStructureChanged', $._PPP_.SequenceStructureChanged);
		app.unbind('onSourceClipSelectedInProjectPanel');
		app.bind('onSourceClipSelectedInProjectPanel', reportProjectItemSelectionChanged);
		app.unbind('onActiveSequenceSelectionChanged');
		app.bind('onActiveSequenceSelectionChanged', reportSequenceItemSelectionChanged);
	},

	SequenceStructureChanged : function () {
		var seq = app.project.activeSequence;
		if(seq) {
			eventObj.type = "numTracksNotification";
			eventObj.data = seq.videoTracks.numTracks.toString() + ',' + seq.audioTracks.numTracks.toString();
			eventObj.dispatch();
		}
	},

	InsertSubtitle : function (mgtName, text){
		var mgtClip = searchItemWithTreePath(MGT_BIN_NAME + '/' + mgtName, ProjectItemType.CLIP);
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
				var epsTime = seq.getSettings().videoFrameRate.seconds;
				mgtClip.setOverrideFrameRate(1/epsTime);

				for (var i = 0; i < targetAudioTrack.clips.numItems; i++) {
					var clip = targetAudioTrack.clips[i];
					outPoint.seconds = fixTimeError(clip.outPoint.seconds - clip.inPoint.seconds, epsTime) + epsTime / 100;
					mgtClip.setOutPoint(outPoint, 4);
					targetVideoTrack.overwriteClip(mgtClip, clip.start.seconds);

					var mgtComponent = targetVideoTrack.clips[i].getMGTComponent();
					if(mgtComponent === null) continue;
					var sourceText = getSourceTextParam(mgtComponent);
					if(sourceText && i < splitText.length){
						var textObj = JSON.parse(sourceText.getValue());
						textObj.fontTextRunLength = [splitText[i].length];
						textObj.textEditValue = splitText[i];
						sourceText.setValue(JSON.stringify(textObj), (i === targetAudioTrack.clips.numItems - 1));
					}
					progressValueMessage('#busy_progress', i);
				}
			}
			else {
				MessageWarning("Track target is unset.");
			}
		}
		else if(!seq) {
			MessageWarning("No active sequence.");
		} else {
			MessageWarning(mgtName + " clip is not found.");
		}
	},

	InsertSubtitle_PSD : function (importBinTreePath){
		var seq = app.project.activeSequence;
		
		if(seq) {
			var VTrackIndex = 0;
			var ATrackIndex = 0;
			for(; VTrackIndex < seq.videoTracks.numTracks; VTrackIndex++) {
				if (seq.videoTracks[VTrackIndex].isTargeted()) break;
			}
			for(; ATrackIndex < seq.audioTracks.numTracks; ATrackIndex++) {
				if (seq.audioTracks[ATrackIndex].isTargeted()) break;
			}
			if (VTrackIndex < seq.videoTracks.numTracks && ATrackIndex < seq.audioTracks.numTracks) {
				var targetVideoTrack = seq.videoTracks[VTrackIndex];
				var targetAudioTrack = seq.audioTracks[ATrackIndex];

				progressMaxMessage('#busy_progress', targetAudioTrack.clips.numItems - 1);

				var importBin = searchItemWithTreePath(importBinTreePath, ProjectItemType.BIN);
				var projectItemList = [];
				var mediaPathList = [];
				for (var i = 0; i < targetAudioTrack.clips.numItems; i++) {
					var path = changeExt(targetAudioTrack.clips[i].projectItem.getMediaPath(), '.psd');
					projectItemList.push(shallowSearchWithMediaPath(importBin, path, ProjectItemType.CLIP));
					mediaPathList.push(path);
				}
				var importPathDict = {};
				for (var i = 0; i < projectItemList.length; i++) {
					if(projectItemList[i] === null){
						importPathDict[mediaPathList[i]] = 0;
					}
				}
				var importPathList = []
				for(var key in importPathDict) {
					importPathList.push(key);
				}
				if(importPathList.length > 0){
					app.project.importFiles(importPathList, true, importBin, false);
				}
				
				for (var i = 0; i < projectItemList.length; i++) {
					if(projectItemList[i] === null){
						projectItemList[i] = shallowSearchWithMediaPath(importBin, mediaPathList[i], ProjectItemType.CLIP);
					}
				}
				var outPoint = new Time();
				var epsTime = seq.getSettings().videoFrameRate.seconds;

				for (var i = 0; i < targetAudioTrack.clips.numItems; i++) {
					var clip = targetAudioTrack.clips[i];
					var projectItem = projectItemList[i];
					if(projectItem === null) continue;
					projectItem.setOverrideFrameRate(1/epsTime);
					outPoint.seconds = fixTimeError(clip.outPoint.seconds - clip.inPoint.seconds, epsTime) + epsTime / 100;
					projectItem.setOutPoint(outPoint.ticks, 4)
					targetVideoTrack.overwriteClip(projectItem, clip.start.seconds);
					projectItem.setOverrideFrameRate(0);
					progressValueMessage('#busy_progress', i);
				}
			}
			else {
				MessageWarning("Track target is unset.");
			}
		}
		else if(!seq) {
			MessageWarning("No active sequence.");
		}
	},

	GetTragetAudioClipMediaPath: function() {
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

	GetMGTClipName: function () {
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
		var root = shallowSearch(app.project.rootItem, MGT_BIN_NAME, ProjectItemType.BIN);
		var clipNames = [];
		if(root) {
			deepSearchMGT(root, clipNames);
		}
		return clipNames.join("\n");
	},

	CaptureSelectedClipProperties: function() {
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
						var properties = component.properties[j];
						if(properties.displayName !== DISPLAY_NAME_SRC_TEXT_V1 && properties.displayName !== DISPLAY_NAME_SRC_TEXT_V2) {
							propertyNames.properties.push({name:properties.displayName});
							propertyObject.propertyNames.push(properties.displayName);
							if(properties.displayName.indexOf(LABEL_COLOR) !== -1) {
								propertyObject.propertyValues.push(properties.getColorValue());									
							} else {
								propertyObject.propertyValues.push(properties.getValue());	
							}
						} else {
							var srcTextNames = {componentName: properties.displayName, properties : []};
							var srcTextPropertyObject = {componentName: properties.displayName, propertyNames : [], propertyValues: []};
							var srcTextComponent = JSON.parse(properties.getValue());						
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

	DeployCapturedProperties: function(deployParams) {
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
				progressMaxMessage('#busy_progress', selectClips.length - 1);
				for(var i = 0; i < selectClips.length; i++) {
					var updateUI = (i === selectClips.length - 1);
					var components = selectClips[i].components;
					for(var j = 0; j < deployObj.components.length; j++) {
						var deployComponetName = deployObj.components[j].componentName;
						var deployProperties = deployObj.components[j].properties;
						if(deployComponetName !== DISPLAY_NAME_SRC_TEXT_V1 && deployComponetName !== DISPLAY_NAME_SRC_TEXT_V2) {
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
							var sourceText = getSourceTextParam(mgtComponent);
							var textObj = JSON.parse(sourceText.getValue());
							for(var k = 0; k < deployProperties.length; k++) {
								textObj[deployProperties[k]] = deployObj.components[j].values[k];
							}							
							sourceText.setValue(JSON.stringify(textObj), updateUI); 
						}
					}
					progressValueMessage('#busy_progress', i);
				}
			}
		}
	},

	GetActorBinName: function() {
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

	GetActorStructure: function(binName) {
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
		var root = shallowSearch(ActorBinItem, binName, ProjectItemType.BIN);
		var actorStructure = [];
		if(root) {
			deepSearchActStructure(root, actorStructure);
		}
		return actorStructure.join(',');
	},

	GetCurrentActorClipTreePath: function(sequenceIndex, currentTime) {
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
				var j = 0;
				for(; j < clips.numItems; j++) {
					if(currentTime >= clips[j].start.seconds && currentTime < clips[j].end.seconds) {
						if(clips[j].projectItem && clips[j].projectItem.isSequence()){
							var animSeq = trackItemToSequence(clips[j]);
							if(getAnimationSequenceLinkInfo(animSeq) !== null) {
								var marker = getTransitionMarkerAtTime(animSeq.markers, currentTime);
								if(marker !== null){
									// '/' is animation mark
									treePathList.push('/' + getTransitionForClipset(animSeq, marker));
								}
							} else {
								treePathList.push('');	
							}
						} else {
							treePathList.push(getTreePathFromActorClip(clips[j]));
						}
						break;
					}
				}
				if(j === clips.numItems) {
					treePathList.push('delete');
				}
			}
		}
		return treePathList;
	},

	ImportMOGRTFile: function(pathList, nameList) {
		var dummyClip = getDummyClip()
		var seq = app.project.createNewSequenceFromClips('importmogrt', [dummyClip], ActorBinItem);
		var path = pathList.split('\n');
		var name = nameList.split('\n');
		for(var i = 0; i < path.length; i++) {
			var trackItem = seq.importMGT(path[i], 0, 0, 0);
			trackItem.projectItem.name = name[i];
		}
		app.project.deleteSequence(seq);
	},

	GetActorStructureMediaPath: function(actorName) {
		var actBin = shallowSearch(ActorBinItem, actorName, ProjectItemType.BIN);
		if(actBin) {
			for(var i = 0; i < actBin.children.numItems; i++) {
				if(actBin.children[i].type === ProjectItemType.FILE) {
					var mediaPath = actBin.children[i].getMediaPath();
					var lastIndex = mediaPath.lastIndexOf(".");
					if(mediaPath.substr(lastIndex + 1) === 'txt'){
						return mediaPath.replace(/\\/g, '/');
					}
				}
			}
		}

		return '';
	},

	GetActorStructureAndMediaPath: function(actorName) {
		var mediaPath = $._PPP_.GetActorStructureMediaPath(actorName);
		var structure = $._PPP_.GetActorStructure(actorName);
		return mediaPath + '\n' + structure;
	},

	GetActorClipMediaPath: function(actorName, treePathCSV) {
		var _treePathList = treePathCSV.split(',');
		var mediaPathList = [];
		for(var i = 0; i < _treePathList.length; i++) {
			var clip = getActorClipWithTreePath(actorName, _treePathList[i]);
			if(clip !== null){
				mediaPathList.push(clip.getMediaPath());
			}
		}
		return mediaPathList.join(',');
	},

	GetSettingsMediaPath: function() {
		var mediaPath = "";
		searchActBin();
		if(ActorBinItem) {
			var file = shallowSearch(ActorBinItem, SETTINGS_FILENAME, ProjectItemType.FILE);
			if(file) {
				mediaPath = file.getMediaPath();
			}
		}
		return mediaPath;
	},

	ImportSettingsFile: function(path) {
		if(ActorBinItem) {
			return app.project.importFiles([path], true, ActorBinItem, false);
		}
		return false;
	},

	SetLinkSequence: function(index) {
		if(linkSequence[index]){
			$._PPP_.CheckLinkSequenceFramerate(index);
			return SEQUENCE_LINK_SUCCESS;
		}
		var seq = app.project.activeSequence;
		if(seq) {
			var sel = seq.getSelection();
			if (sel && (sel !== "Connection to object lost")){
				if(sel.length === 0) return LINKERROR_SEQUENCE_NOT_SELECT;
				if(sel.length !== 1) return LINKERROR_SEQUENCE_MULTIPLE_SELECT;
				if(sel[0].name !== 'anonymous' && sel[0].projectItem && sel[0].projectItem.isSequence()) {
					var linkSeq = trackItemToSequence(sel[0]);
					if(linkSeq !== null) {
						linkSequence[index] = linkSeq;
						linkSequenceParents[index] = seq;
						$._PPP_.CheckLinkSequenceFramerate(index);
						return SEQUENCE_LINK_SUCCESS;
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

	CheckLinkSequenceFramerate: function(index){
		if(linkSequence[index]){
			var time1 = linkSequenceParents[index].getSettings().videoFrameRate.seconds;
			var time2 = linkSequence[index].getSettings().videoFrameRate.seconds;
			if(time1 !== time2){
				eventObj.type = "framerateMismatchMessage";
				eventObj.data = index;
				eventObj.dispatch();
				return;
			}

			if(linkAnimationSequence[index]){
				for(var i = 0; i < linkAnimationSequence[index].length; i++){
					if(linkAnimationSequence[index][i]){
						if(time1 !== linkAnimationSequence[index][i].getSettings().videoFrameRate.seconds){
							eventObj.type = "framerateMismatchMessage";
							eventObj.data = index;
							eventObj.dispatch();
							return;	
						}
					}
				}
			}
			eventObj.type = "framerateMatchMessage";
			eventObj.data = index;
			eventObj.dispatch();
		}
	},

	DelinkSequence: function(index, skip_linkseq) {
		if(!skip_linkseq){
			delete linkSequence[index];
			delete linkSequenceParents[index];
		}
		delete linkAnimationSequence[index];
		delete linkAnimationProperties[index];
	},

	InsertActorClip: function(actorName, sequenceIndex, trackIndex, clipTreePath, l, t, w, h, actor_l, actor_t, startTime, endFlag) {
		var activeSequence = app.project.activeSequence;
		var seq = linkSequence[sequenceIndex];
		if(startTime < 0) {
			if(activeSequence) {
				var sequenceList = getSequenceTrackItemsInSequence(activeSequence, seq.sequenceID);
				var playerPosition = activeSequence.getPlayerPosition();
				var targetSequence = getClipAtTime(sequenceList, playerPosition.seconds);
				if(targetSequence === null) return;
				startTime = getClipLocalTime(targetSequence, playerPosition.seconds);
			}
		}
		var clip = null;
		var deleteInsertClip = false;
		if(clipTreePath === 'delete') {
			clip = getDummyClip();
			deleteInsertClip = true;
		} else if(clipTreePath === '') {
			return;
		} else {
			clip = getActorClipWithTreePath(actorName, clipTreePath);
			if(clip === null) {
				alert('clip not found\n' + ACT_BIN_NAME + '/' + actorName + '/' + clipTreePath);
				return;
			}
		}

		if(seq && clip){
			makeVideoTrack(seq, trackIndex);
			var track = seq.videoTracks[trackIndex];
			if(!track.isLocked()){
				overwriteVideoClip(clip, seq, track, startTime, endFlag, activeSequence, Number(l), Number(t), Number(w), Number(h), Number(actor_l), Number(actor_t));
				if(deleteInsertClip) {
					var searchIndex = track.clips.numItems - 1;
					for(var j = searchIndex; j >= 0 ; j--){
						if(track.clips[j].projectItem && track.clips[j].projectItem.nodeId === DummyClipNodeID) {
							track.clips[j].remove(false, false);
						}
					}
				}
			}
		}
	},

	NextEditPoint: function() {
		var seq = app.project.activeSequence;
		if(seq) {
			var currentPlayerPos = seq.getPlayerPosition();
			currentPlayerPos.seconds += seq.getSettings().videoFrameRate.seconds * 0.9;
			var minSeconds = Number.MAX_VALUE;
			var check = function(tracks) {
				for(var i = 0; i < tracks.numTracks; i++) {
					if(tracks[i].isTargeted()) {
						var targetTrack = tracks[i];
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
			}
			check(seq.videoTracks);
			check(seq.audioTracks);
			var epsTime = seq.getSettings().videoFrameRate.seconds;
			currentPlayerPos.seconds = fixTimeError(minSeconds, epsTime);
			seq.setPlayerPosition(currentPlayerPos.ticks);
		}
	},

	PrevEditPoint: function() {
		var seq = app.project.activeSequence;
		if(seq) {
			var currentPlayerPos = seq.getPlayerPosition();
			currentPlayerPos.seconds -= seq.getSettings().videoFrameRate.seconds * 0.9;
			var maxSeconds = 0;
			var check = function(tracks) {
				for(var i = 0; i < tracks.numTracks; i++) {
					if(tracks[i].isTargeted()) {
						var targetTrack = tracks[i];
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
			}
			check(seq.videoTracks);
			check(seq.audioTracks);
			var epsTime = seq.getSettings().videoFrameRate.seconds;
			currentPlayerPos.seconds = fixTimeError(maxSeconds, epsTime);
			seq.setPlayerPosition(currentPlayerPos.ticks);
		}
	},

	CreateActorSequence: function(actorName, seqName, baseClipTreePath, width, height) {
		var clip = getActorClipWithTreePath(actorName, baseClipTreePath);
		var parent = null;
		if(projectSelectionItem !== null){
			parent = searchItemWithTreePath(projectSelectionItem, ProjectItemType.BIN);
		}
		var seq = app.project.createNewSequenceFromClips(seqName, [clip], parent);
		seq.close();
		width = Number(width);
		height = Number(height);
		if(width > 0 && height > 0){
			var settings = seq.getSettings();
			settings.videoFrameWidth = width;
			settings.videoFrameHeight = height;
			seq.setSettings(settings);
		}
	},

	ImportActorStructureFile : function (path, actName) {
		if (app.project && path) {
			var insertBin = shallowSearch(ActorBinItem, actName, ProjectItemType.BIN);
			return app.project.importFiles([path], true, insertBin, false);
		}
	},

	ImportActor : function(actorName, actorStructureFilePath, treePathList, importPathList){
		treePathList = treePathList.split('\n');
		importPathList = importPathList.split('\n');
		var actorRootBin = ActorBinItem.createBin(actorName);
		var importListByBin = {};
		var nameListByBin = {};
		var importListRoot = [];
		var nameListRoot = [];
		var progress_max = 1;

		for(var i = 0; i < treePathList.length; i++){
			var sepIndex = treePathList[i].lastIndexOf('/');
			if(sepIndex >= 0){
				var binPath = treePathList[i].slice(0, sepIndex);
				if(!importListByBin[binPath]){
					importListByBin[binPath] = [];
					nameListByBin[binPath] = [];
					progress_max++;
				}		
				importListByBin[binPath].push(importPathList[i]);
				nameListByBin[binPath].push(treePathList[i].slice(sepIndex + 1));
			} else {
				importListRoot.push(importPathList[i]);
				nameListRoot.push(treePathList[i]);
			}
		}
		progressMaxMessage('#busy_progress', progress_max);

		var _rename = function(parentBin, importList, nameList){
			for(var i = 0; i < parentBin.children.numItems; i++){
				var mediaPath = parentBin.children[i].getMediaPath().replace(/\\/g, '/');
				for(var j = 0; j < importList.length; j++){
					if(mediaPath === importList[j]){
						parentBin.children[i].name = nameList[j];
						break;
					}
				}
			}
		}
		app.project.importFiles([actorStructureFilePath], true, actorRootBin, false);
		app.project.importFiles(importListRoot, true, actorRootBin, false);
		_rename(actorRootBin, importListRoot, nameListRoot);
		var count = 1;
		progressValueMessage('#busy_progress', count);

		var binStore = {}
		for(var key in importListByBin) {
			var treeName = key.split('/');
			var _binStore = binStore;
			var parentBin = actorRootBin;
			for(var i = 0; i < treeName.length; i++){
				if(!_binStore[treeName[i]]){
					_binStore[treeName[i]] = parentBin.createBin(treeName[i]);
				}
				parentBin = _binStore[treeName[i]];
			}
			app.project.importFiles(importListByBin[key], true, parentBin, false);
			_rename(parentBin, importListByBin[key], nameListByBin[key]);
			count++;
			progressValueMessage('#busy_progress', count);
		}
	},

	ImportFiles : function (path, trackIndex, importBinTreePath) {
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
			var importBin = searchItemWithTreePath(key, ProjectItemType.BIN);
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
					var importBin = searchItemWithTreePath(binTreePathList[i], ProjectItemType.BIN);
					var clipName = targetPath.slice(targetPath.lastIndexOf('/') + 1);
					var projectItem = shallowSearch(importBin, clipName, ProjectItemType.CLIP);
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
						var sourceText = getSourceTextParam(mgtComponent);
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
								var sourceText = getSourceTextParam(mgtComponent);
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
				var mgtComponent = OperationTargetList[i].getMGTComponent();
				var sourceText = getSourceTextParam(mgtComponent);
				if(sourceText) {
					var textObj = JSON.parse(sourceText.getValue());
					textObj.fontTextRunLength = [_textList[i].length];
					textObj.textEditValue = _textList[i];
					sourceText.setValue(JSON.stringify(textObj), (i === length - 1)); 
				}
				if(_markerColorIndex[i] !== '-1') {
					var clipTime = OperationTargetList[i].start.seconds;
					clipTime = fixTimeError(clipTime, epsTime);
					var marker = markers.createMarker(clipTime);
					marker.setColorByIndex(Number(_markerColorIndex[i]));
					marker.comments = _textList[i];
				}
				progressValueMessage('#busy_progress', i);
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
					var sourceText = getSourceTextParam(mgtComponent);
					if(sourceText){
						var textObj = JSON.parse(sourceText.getValue());
						text = textObj.textEditValue;
					}
				}
			}
		}
		return text;
	},

	ExistBinTreePath : function(treePath) {
		if(searchItemWithTreePath(treePath, ProjectItemType.BIN)) {
			return true;
		}
		return '';
	},
	
	ExistClipTreePath : function(treePath) {
		if(searchItemWithTreePath(treePath, ProjectItemType.CLIP)) {
			return true;
		}
		return '';
	},
	GetMediaPath_File : function(treePath) {
		var projectItem = searchItemWithTreePath(treePath, ProjectItemType.FILE);
		if(projectItem) {
			return projectItem.getMediaPath();
		}
		return '';
	},

	GetSelectedSequenceTrackNum : function() {
		var seq = app.project.activeSequence;
		if(seq) {
			var selection = seq.getSelection();
			if(selection.length) {
				if(selection[0].projectItem && selection[0].projectItem.isSequence) {
					var targetSequence = selection[0];
					for(var i = 0; i < app.project.sequences.numSequences; i++){
						if(app.project.sequences[i].projectItem !== null && targetSequence.projectItem.nodeId === app.project.sequences[i].projectItem.nodeId){
							return app.project.sequences[i].videoTracks.numTracks.toString() + ',' + app.project.sequences[i].audioTracks.numTracks.toString();
						}
					}
				}
			}
		}
		return '';
	},

	TriggerClipOverwrite : function(targetSeqFlag, trackIndex, startClipTreePath, endClipTreePath, startTriggerInsertFlag, endTriggerInsertFlag, actor_l, actor_t, start_bbox, end_bbox) {
		var seq = app.project.activeSequence;
		var activeSeq = app.project.activeSequence;
		if(targetSeqFlag == 0) {
			if(seq) {
				var selection = seq.getSelection();
				seq = null;
				if(selection.length) {
					if(selection[0].projectItem && selection[0].projectItem.isSequence) {
						var targetSequence = selection[0];
						for(var i = 0; i < app.project.sequences.numSequences; i++){
							if(app.project.sequences[i].projectItem !== null && targetSequence.projectItem.nodeId === app.project.sequences[i].projectItem.nodeId){
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
			var startClip = searchItemWithTreePath(startClipTreePath, ProjectItemType.CLIP);
			var endClip = searchItemWithTreePath(endClipTreePath, ProjectItemType.CLIP);

			var ATrackIndex = 0;
			for(; ATrackIndex < activeSeq.audioTracks.numTracks; ATrackIndex++) {
				if (activeSeq.audioTracks[ATrackIndex].isTargeted()) break;
			}
			if (ATrackIndex < activeSeq.audioTracks.numTracks) {
				var sourceAudioTrack = activeSeq.audioTracks[ATrackIndex];
				progressMaxMessage('#busy_progress', sourceAudioTrack.clips.numItems - 1);

				var sl = 0;
				var st = 0;
				var sw = 0;
				var sh = 0;
				if(startClip) {
					startClip.setOverrideFrameRate(1 / epsTime);
					if(start_bbox){
						start_bbox = start_bbox.split(',');
						sl = Number(start_bbox[0]);
						st = Number(start_bbox[1]);
						sw = Number(start_bbox[2]);
						sh = Number(start_bbox[3]);
				}
				}
				var el = 0;
				var et = 0;
				var ew = 0;
				var eh = 0;
				if(endClip) {
					endClip.setOverrideFrameRate(1 / epsTime);
					if(end_bbox){
						end_bbox = end_bbox.split(',');
						el = Number(end_bbox[0]);
						et = Number(end_bbox[1]);
						ew = Number(end_bbox[2]);
						eh = Number(end_bbox[3]);
				}
				}
				if(actor_l) actor_l = Number(actor_l);
				if(actor_t) actor_t = Number(actor_t);

				var targetIsActiveSeq = true;
				if(activeSeq.sequenceID !== seq.sequenceID){
					var sequenceList = getSequenceTrackItemsInSequence(activeSeq, seq.sequenceID);
					targetIsActiveSeq = false;
				}
				var targetTime = 0
				for (var sourceClipIndex = 0; sourceClipIndex < sourceAudioTrack.clips.numItems; sourceClipIndex++) {
					var sourceAudioClip = sourceAudioTrack.clips[sourceClipIndex];
					if(startClip) {
						if(!targetIsActiveSeq){
							var targetSequence = getClipAtTime(sequenceList, sourceAudioClip.start.seconds);
							targetTime = getClipLocalTime(targetSequence, sourceAudioClip.start.seconds);
						} else {
							targetTime = sourceAudioClip.start.seconds;
						}
						overwriteVideoClip(startClip, seq, targetTrack, targetTime, startTriggerInsertFlag, activeSeq, sl, st, sw, sh, actor_l, actor_t);
					}
					if(endClip) {
						if(!targetIsActiveSeq){
							var targetSequence = getClipAtTime(sequenceList, sourceAudioClip.end.seconds);
							targetTime = getClipLocalTime(targetSequence, sourceAudioClip.end.seconds);
						} else {
							targetTime = sourceAudioClip.end.seconds;
						}
						overwriteVideoClip(endClip, seq, targetTrack, targetTime, endTriggerInsertFlag, activeSeq, el, et, ew, eh, actor_l, actor_t);
					}
					progressValueMessage('#busy_progress', sourceClipIndex);
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

	setLocale : function (localeFromCEP) {
		$.locale = localeFromCEP;
	},

	/* 
		Parameters
		----------
		linkedSequenceIndex
			Index of actor.
		animationTrackIndex
			Track index of the animation.
		treePathCSV
			Clips that may be used, separated by commas.

		Returns
		-------

	*/
	SetupAnimationMarker : function(actorName, groupName, linkedSequenceIndex, animationTrackIndex, treePathCSV, bbox_list, isLightweight){
		isLightweight = Number(isLightweight);
		var treePathList = treePathCSV.split(',');
		var startTime = new Time();
		startTime.seconds = -60*60;
		var duration = new Time();
		duration.seconds = 60*60*11;
		var clips = [];
		if(animationTrackIndex < linkSequence[linkedSequenceIndex].videoTracks.numTracks){
			clips = linkSequence[linkedSequenceIndex].videoTracks[animationTrackIndex].clips;
		}
		var seq = getFirstSequenceFromTrackItems(clips);
		var newAnimationSequence = false;
		if(seq === null) {
			var sequenceID = linkSequence[linkedSequenceIndex].sequenceID;
			for(var i = 0; i < app.project.sequences.numSequences; i++){
				var info = getAnimationSequenceLinkInfo(app.project.sequences[i]);
				if(info !== null && info[ANIMATION_LINK_INFO_PARENT_SEQUENCE_ID] === sequenceID && info[ANIMATION_LINK_INFO_TRACK_INDEX] == animationTrackIndex) {
					seq = app.project.sequences[i];
					break;
				}
			}
		}

		if(seq === null) {
			newAnimationSequence = true;
			var parent = getParentBin(linkSequence[linkedSequenceIndex].projectItem);
			var initializeClip = getActorClipWithTreePath(actorName, treePathList[0]);
			initializeClip.setInPoint(startTime, 4);
			initializeClip.setOutPoint(duration, 4);
			seq = app.project.createNewSequenceFromClips(actorName + '_' + groupName, [initializeClip], parent);
			seq.close();

			var component = getComponentObject(seq.videoTracks[0].clips[0], OPACITY_COMPONENT_NAME);
			var property = getPropertyObject(component, [OPACITY_PROPERTY_NAME]);
			initializeKey(property, 100);
		}
		
		var settings = seq.getSettings();
		bbox_list = castBBoxListToNumber(bbox_list);
		var outer_bbox = [];
		if(isLightweight){
			outer_bbox = getOuterBBox(bbox_list);
			settings.videoFrameWidth = outer_bbox[2];
			settings.videoFrameHeight = outer_bbox[3];
			seq.setSettings(settings);
			if(newAnimationSequence){
				anchorUpdate(seq.videoTracks[0].clips[0], bbox_list[0], outer_bbox, false);
			}
		} else {
			outer_bbox[0] = 0;
			outer_bbox[1] = 0;
 			outer_bbox[2] = settings.videoFrameWidth;
			outer_bbox[3] = settings.videoFrameHeight;
		}

		var animation_link_info = [];
		animation_link_info[ANIMATION_LINK_INFO_PARENT_SEQUENCE_ID] = linkSequence[linkedSequenceIndex].sequenceID;
		animation_link_info[ANIMATION_LINK_INFO_TRACK_INDEX] = animationTrackIndex.toString();
		animation_link_info[ANIMATION_LINK_INFO_BBOX] = outer_bbox.join(',');
		setAnimationSequenceLinkInfo(seq, animation_link_info);

		if(!linkAnimationSequence[linkedSequenceIndex]){
			linkAnimationSequence[linkedSequenceIndex] = [];
		}
		linkAnimationSequence[linkedSequenceIndex][animationTrackIndex] = seq;
		$._PPP_.CheckLinkSequenceFramerate(linkedSequenceIndex);

		var indexes = {};
		for(var i = 0; i < seq.videoTracks.numTracks; i++) {
			if(seq.videoTracks[i].clips.numItems > 0) {
				var clip = seq.videoTracks[i].clips[0];
				indexes[getTreePathFromActorClip(clip)] = i;
			}
		}

		var lastBlankIndex = 0;
		for(var i = 0; i < treePathList.length; i++) {
			var path = treePathList[i];
			if(!indexes.hasOwnProperty(path)){
				var clip = getActorClipWithTreePath(actorName, path);
				clip.setInPoint(startTime, 4);
				clip.setOutPoint(duration, 4);
				for(; lastBlankIndex < seq.videoTracks.numTracks; lastBlankIndex++) {
					if(seq.videoTracks[lastBlankIndex].clips.numItems === 0){
						seq.videoTracks[lastBlankIndex].overwriteClip(clip, 0);
						indexes[path] = lastBlankIndex;
						break;
					}
				}
				if(lastBlankIndex === seq.videoTracks.numTracks) {
					seq.videoTracks[seq.videoTracks.numTracks - 1].setLocked(1);				
					seq.videoTracks[seq.videoTracks.numTracks - 1].overwriteClip(clip, 0);
					indexes[path] = lastBlankIndex;		
				}

				var component = getComponentObject(seq.videoTracks[lastBlankIndex].clips[0], OPACITY_COMPONENT_NAME);
				var property = getPropertyObject(component, [OPACITY_PROPERTY_NAME]);
				initializeKey(property, 0);
				if(isLightweight){
					anchorUpdate(seq.videoTracks[lastBlankIndex].clips[0], bbox_list[i], outer_bbox, false);
				}
			}
		}

		if(!linkAnimationProperties[linkedSequenceIndex]) {
			linkAnimationProperties[linkedSequenceIndex] = [];
		}
		if(!linkAnimationProperties[linkedSequenceIndex][animationTrackIndex]) {
			linkAnimationProperties[linkedSequenceIndex][animationTrackIndex] = [];
		}

		var fAnimationProperties = linkAnimationProperties[linkedSequenceIndex][animationTrackIndex];
		for(var i = 0; i < seq.videoTracks.numTracks; i++){
			if(seq.videoTracks[i].clips.length > 0){
				var component = getComponentObject(seq.videoTracks[i].clips[0], OPACITY_COMPONENT_NAME);
				var property = getPropertyObject(component, [OPACITY_PROPERTY_NAME]);
				fAnimationProperties.push(property);
			} else {
				fAnimationProperties.push(null);
			}
		}

		for(var i = 0; i < seq.videoTracks.numTracks; i++){
			if(seq.videoTracks[i].isLocked()){
				seq.videoTracks[i].setLocked(0);
			}
		}

		var sorted = [];
		for(var key in indexes){
			sorted[indexes[key]] = key;
		}
		return sorted.join(',');
	},

	InsertFrameAnimationMarker : function(linkedSequenceIndex, animationTrackIndex, comment, endFlag, type, sourceIndex, actor_l, actor_t) {
		linkedSequenceIndex = Number(linkedSequenceIndex);
		animationTrackIndex = Number(animationTrackIndex);
		makeVideoTrack(linkSequence[linkedSequenceIndex], animationTrackIndex);
		var track = linkSequence[linkedSequenceIndex].videoTracks[animationTrackIndex];
		if(track.isLocked()){
			return;
		}
		var clips = linkSequence[linkedSequenceIndex].videoTracks[animationTrackIndex].clips;
		var activeSequence = app.project.activeSequence;
		var sequenceList = getSequenceTrackItemsInSequence(activeSequence, linkSequence[linkedSequenceIndex].sequenceID);
		var playerPosition = activeSequence.getPlayerPosition();
		var targetSequence = getClipAtTime(sequenceList, playerPosition.seconds);
		var linkedSequenceTime = getClipLocalTime(targetSequence, playerPosition.seconds);

		var seq = linkAnimationSequence[linkedSequenceIndex][animationTrackIndex];
		var epsTime = seq.getSettings().videoFrameRate.seconds;

		var info = getAnimationSequenceLinkInfo(seq);
		var bbox = info[ANIMATION_LINK_INFO_BBOX].split(',');
		overwriteVideoClip(seq.projectItem, linkSequence[linkedSequenceIndex], track, linkedSequenceTime, endFlag, activeSequence,
			Number(bbox[0]), Number(bbox[1]), Number(bbox[2]), Number(bbox[3]), Number(actor_l), Number(actor_t));

		var trackItem = getTrackItemAtTime(clips, linkedSequenceTime);
		var newStartTime = fixTimeError(getClipLocalTime(trackItem, linkedSequenceTime), epsTime);
		var newEndTime =  fixTimeError(getClipLocalTime(trackItem, trackItem.outPoint.seconds), epsTime);
		var markers = seq.markers;
		var marker = null;
		var currentMarker = null;

		var removeList = [];
		var trimmingStart = [];
		var trimmingMid = [];
		var trimmingEnd = [];
		if(markers.numMarkers > 0) {
			marker = getFirstTransitionMarker(markers);
			while(marker !== null) {
				var currentStartTime = fixTimeError(marker.start.seconds, epsTime);
				var currentEndTime = fixTimeError(marker.end.seconds, epsTime);
				if(newStartTime <= currentStartTime || newStartTime <= currentEndTime) {
					if(currentStartTime === newStartTime && currentEndTime === newEndTime){
						currentMarker = marker;
					} else if(newStartTime <= currentStartTime && currentEndTime <= newEndTime) {
						removeList.push(marker);
					} else if(currentStartTime < newStartTime) {
						if(newEndTime < currentEndTime){
							trimmingMid.push(marker);
						} else if(newStartTime < currentEndTime){
							trimmingEnd.push(marker);
						}
					} else if(currentStartTime < newEndTime && newEndTime < currentEndTime){
						trimmingStart.push(marker);
					} else if(newEndTime < currentStartTime && newEndTime < currentEndTime) {
						break;
					}
				} else if(currentStartTime < 0 && currentEndTime < 0){
					removeList.push(marker);
				}
				marker = getNextTransitionMarker(markers, marker);
			}
		}

		for(var i = 0; i < removeList.length; i++){
			markers.deleteMarker(removeList[i]);
		}
		for(var i = 0; i < trimmingEnd.length; i++){
			trimmingEnd[i].end = newStartTime;
		}
		for(var i = 0; i < trimmingStart.length; i++){
			var tmpEnd = trimmingStart[i].end.seconds;
			trimmingStart[i].start = newEndTime;
			trimmingStart[i].end = tmpEnd;
		}
		for(var i = 0; i < trimmingMid.length; i++){
			var postMarker = markers.createMarker(newEndTime);
			postMarker.end = trimmingMid[i].end.seconds;
			postMarker.name = TRANSITION_MARKER_NAME;
			postMarker.comments = trimmingMid[i].comments;
			postMarker.setTypeAsSegmentation();
			trimmingMid[i].end = newStartTime;
		}

		if(currentMarker !== null){
			currentMarker.comments = comment;
		} else {
			var newMarker = markers.createMarker(newStartTime);
			newMarker.end = newEndTime;
			newMarker.name = TRANSITION_MARKER_NAME;
			newMarker.comments = comment;
			newMarker.setTypeAsSegmentation();
		}

		// Simple bake
		fAnimationSequence = linkAnimationSequence[linkedSequenceIndex][animationTrackIndex];
		AnimationProperties = linkAnimationProperties[linkedSequenceIndex][animationTrackIndex];
		if(type == 0){
			bakeFrameAnimation_Random(newStartTime, newEndTime - epsTime, true, true);
		} else if(type == 1 && sourceIndex !== undefined && sourceIndex >= 0){
			sourceIndex = Number(sourceIndex);
			var seq = linkSequenceParents[linkedSequenceIndex];
			if(seq.audioTracks.numTracks > sourceIndex){
				var sourceClips = seq.audioTracks[sourceIndex].clips;
				var clipFound = false;
				var bakeClips = [];
				var simpleBakeClips = [];
				var clipLength = sourceClips.numItems;
				for(var i = 0; i < clipLength; i++){
					if(!clipFound){
						if(playerPosition.seconds <= sourceClips[i].start.seconds){
							bakeClips.push(sourceClips[i]);
							clipFound = true;
							break;
						}
					}else{
						// if(sourceClips[i].start.seconds < newEndTime && simpleBakeClips.length < 5){
						// 	simpleBakeClips.push(sourceClips[i]);
						// } else {
						// 	break;
						// }
					}
				}
				clearFrameAnimation(fAnimationSequence, AnimationProperties, newStartTime, newEndTime, true);
				if(bakeClips.length > 0){
					$._PPP_.FrameAnimation_Audio(linkedSequenceIndex, animationTrackIndex, sourceIndex, bakeClips);
				}else{
					updateUI(AnimationProperties);
				}
				// if(simpleBakeClips.length > 0){
				// 	bakeFrameAnimationSimple(simpleBakeClips, linkedSequenceIndex, animationTrackIndex, newEndTime);
				// }
			}
		}
	},

	/* 
		Parameters
		----------
		sourceClips
	 		trackItems sorted by time
	*/
	FrameAnimation_Audio : function(linkedSequenceIndex, animationTrackIndex, sourceIndex, sourceClips, id) {
		fLinkedSequenceIndex = linkedSequenceIndex;
		fAnimationSequenceIndex = animationTrackIndex;
		fAnimationSourceIndex = sourceIndex;
		fAnimationSequence = linkAnimationSequence[fLinkedSequenceIndex][fAnimationSequenceIndex];
		AnimationProperties = linkAnimationProperties[fLinkedSequenceIndex][fAnimationSequenceIndex];
		if(fAnimationSequence === null) {
			alert('assert');
			return;
		}

		if(sourceClips === undefined || sourceClips === '') {
			fAnimationSourceClips = linkSequenceParents[fLinkedSequenceIndex].audioTracks[sourceIndex].clips;
			fAnimationSourceClipsLength = fAnimationSourceClips.numItems;
			bakeAllDuration = true;
			var markers = fAnimationSequence.markers;
			if(markers.numMarkers <= 1) return;
			var currentMarker = getFirstTransitionMarker(markers);
			var transition = getTransition(currentMarker);
			for(var i = 0; i < AnimationProperties.length; i++){
				if(transition[0].index === i){
					initializeKey(AnimationProperties[i], 100);
				}else{
					initializeKey(AnimationProperties[i], 0);
				}
			}
		} else {
			bakeAllDuration = false;
			fAnimationSourceClips = sourceClips;
			fAnimationSourceClipsLength = fAnimationSourceClips.length;
		}

		if(id){
			bakeTextMessage(id, BAKE_ANIMATION_AUDIO_MESSAGE1);
			bakeMaxMessage(id, fAnimationSourceClipsLength);
			bakeAudio_ID = id;
		}

		fAnimationSourceCount = 0;
		fAnimationKeypoints = [];
		fAnimationStartTime = [];
		for(var i = 0; i < fAnimationSourceClipsLength; i++) {
			eventObj.type = "getAudioAnimKeyPoint";
			eventObj.data = fAnimationSourceClips[i].projectItem.getMediaPath() + ',' + i.toString();
			eventObj.dispatch();
		}
	},

	SetFrameAnimationKeypoints_Audio : function(clipIndex, keypoints, startTime) {
		fAnimationKeypoints[Number(clipIndex)] = keypoints;
		fAnimationStartTime[Number(clipIndex)] = startTime;
		fAnimationSourceCount++;
		if(fAnimationSourceCount === fAnimationSourceClipsLength){
			var id = bakeAudio_ID;
			bakeAudio_ID = null;
			bakeFrameAnimation_Audio(bakeAllDuration, fAnimationKeypoints, fAnimationStartTime, id);
		}
	},

	FrameAnimation_Random : function(linkedSequenceIndex, animationTrackIndex, id) {
		fAnimationSequence = linkAnimationSequence[linkedSequenceIndex][animationTrackIndex];
		var activeSequence = app.project.activeSequence;
		var sequenceList = getSequenceTrackItemsInSequence(activeSequence, linkSequence[linkedSequenceIndex].sequenceID);
		if(sequenceList.length === 0) return;
		var end = sequenceList[sequenceList.length - 1].outPoint.seconds;

		if(fAnimationSequence === null) {
			alert('assert');
			return;
		}

		AnimationProperties = linkAnimationProperties[linkedSequenceIndex][animationTrackIndex];

		var markers = fAnimationSequence.markers;
		if(markers.numMarkers <= 1) return;
		var currentMarker = getFirstTransitionMarker(markers);
		var transition = getTransition(currentMarker);
		for(var i = 0; i < AnimationProperties.length; i++){
			if(transition[0].index === i){
				initializeKey(AnimationProperties[i], 100);
			}else{
				initializeKey(AnimationProperties[i], 0);
			}
		}
		if(id){
			bakeTextMessage(id, BAKE_ANIMATION_RANDOM_MESSAGE);
			bakeMaxMessage(id, end);
		}

		bakeFrameAnimation_Random(0, end, false, false, id);
	},

	ConvertLightweightSequence : function(actorName, linkedSequenceIndex, changeKey, bbox_list, actor_l, actor_t, isLightweight){
		var seq = app.project.activeSequence;
		if(seq) {
			var selected_clips = seq.getSelection();
			for(var i = 0; i < selected_clips.length; i++){
				selected_clips[i].setSelected(false, i === selected_clips.length - 1);
			}
		}
		
		var sequence = linkSequence[linkedSequenceIndex];
		var parentSequence = linkSequenceParents[linkedSequenceIndex];
		var animationSequenceList = linkAnimationSequence[linkedSequenceIndex];

		var settings = sequence.getSettings();
		var seqWidth = settings.videoFrameWidth;
		var seqHeight = settings.videoFrameHeight;

		changeKey = changeKey.split('\n');

		var anim_sequence_bbox = [];
		var nodeId_list = [];
		bbox_list = castBBoxListToNumber(bbox_list);
		var outer_bbox = getOuterBBox(bbox_list);
		var total_w = outer_bbox[2];
		var total_h = outer_bbox[3];

		for(var i = 0; i < changeKey.length; i++){
			var projectItem = getActorClipWithTreePath(actorName, changeKey[i]);
			nodeId_list[i] = projectItem.nodeId;
		}
		
		// charactor sequence anchor update
		var actorSequenceList = getSequenceTrackItemsInSequence(parentSequence, sequence.sequenceID);
		var actor_anchor_x = [];
		var actor_anchor_y = [];
		var actor_seq_property = [];
		var momentum = 1;
		isLightweight = Number(isLightweight);
		if(isLightweight){
			momentum = -1;
		}
		actor_l = Number(actor_l);
		actor_t = Number(actor_t);
		var progress_max = sequence.videoTracks.numTracks + actorSequenceList.length;
		if(animationSequenceList) progress_max += animationSequenceList.length;
		var progress_count = 0;
		progressMaxMessage('#busy_progress', progress_max);

		for(var i = 0; i < actorSequenceList.length; i++){
			var component = getComponentObject(actorSequenceList[i], DISPLAY_NAME_MOTION);
			var property = getPropertyObject(component, [DISPLAY_NAME_ANCHORPOINT]);
			var currentAnchor = property.getValue();
			actor_anchor_x.push(currentAnchor[0] * seqWidth + momentum * actor_l);
			actor_anchor_y.push(currentAnchor[1] * seqHeight + momentum * actor_t);
			actor_seq_property.push(property);
		}

		if(!isLightweight){
			actor_l = 0;
			actor_t = 0;
		}

		settings.videoFrameWidth = seqWidth = total_w;
		settings.videoFrameHeight = seqHeight = total_h;
		sequence.setSettings(settings);

		for(var i = 0; i < actorSequenceList.length; i++){
			var component = getComponentObject(actorSequenceList[i], DISPLAY_NAME_MOTION);
			var property = getPropertyObject(component, [DISPLAY_NAME_ANCHORPOINT]);
			actor_seq_property[i].setValue([actor_anchor_x[i] / seqWidth, actor_anchor_y[i] / seqHeight], false);
			progress_count += 1;
			progressValueMessage('#busy_progress', progress_count);
		}

		// convert clip in animation sequence
		if(animationSequenceList){
			for(var i = 0; i < animationSequenceList.length; i++){
				var animSeq = animationSequenceList[i];
				if(!animSeq) continue;

				var in_anim_seq_bbox = [];
				for(var j = 0; j < animSeq.videoTracks.numTracks; j++){
					if(animSeq.videoTracks[j].clips.length > 0){
						var clip = animSeq.videoTracks[j].clips[0];
						var nodeId = clip.projectItem.nodeId;
						for(k = 0; k < nodeId_list.length; k++){
							if(nodeId_list[k] === nodeId){
								in_anim_seq_bbox[j] = bbox_list[k];
								break;
							}
						}
					}
				}
				anim_sequence_bbox[i] = getOuterBBox(in_anim_seq_bbox);

				var info = getAnimationSequenceLinkInfo(animSeq);
				info[ANIMATION_LINK_INFO_BBOX] = anim_sequence_bbox[i].join(',');
				setAnimationSequenceLinkInfo(animSeq, info);
				var anim_settings = animSeq.getSettings();
				anim_settings.videoFrameWidth = anim_sequence_bbox[i][2];
				anim_settings.videoFrameHeight = anim_sequence_bbox[i][3];
				animSeq.setSettings(anim_settings);

				for(var j = 0; j < animSeq.videoTracks.numTracks; j++){
					if(animSeq.videoTracks[j].clips.length > 0){
						var clip = animSeq.videoTracks[j].clips[0];
						anchorUpdate(clip, in_anim_seq_bbox[j], anim_sequence_bbox[i], false);
					}
				}
				progress_count += 1;
				progressValueMessage('#busy_progress', progress_count);
			}
		}

		// convert clip in charactor sequence
		var lastClip = null;
		var clip_bbox = [];
		var sequence_bbox = [actor_l, actor_t, seqWidth, seqHeight];
		for(var i = 0; i < sequence.videoTracks.numTracks; i++){
			var clips = sequence.videoTracks[i].clips;
			for(var j = 0; j < clips.numItems; j++){
				var clip = clips[j];
				var nodeId = clip.projectItem.nodeId;
				var k = 0;
				if(!clip.projectItem.isSequence()){
					for(; k < nodeId_list.length; k++){
						if(nodeId_list[k] === nodeId){
							break;
						}
					}

					if(k < bbox_list.length){
						clip_bbox = bbox_list[k];
						lastClip = clip;
						anchorUpdate(clip, clip_bbox, sequence_bbox, false);
					}
				} else {
					for(; k < animationSequenceList.length; k++){
						if(!animationSequenceList[k]) continue;
						if(animationSequenceList[k].projectItem.nodeId === nodeId){
							break;
						}
					}

					clip_bbox = anim_sequence_bbox[k];
					lastClip = clip;
					anchorUpdate(clip, clip_bbox, sequence_bbox, false);
				}
			}
			progress_count += 1;
			progressValueMessage('#busy_progress', progress_count);
		}

		// update UI
		if(lastClip !== null){
			anchorUpdate(lastClip, clip_bbox, sequence_bbox, true);
		}
	},

	ChangeMediaPathForLightweight : function(actorName, changeKey, changeMediaPath){
		if(changeKey !== ''){
			changeKey = changeKey.split('\n');
			changeMediaPath = changeMediaPath.split('\n');
			var osIsWin = $.os.indexOf('Windows') >= 0;
			for(var i = 0; i < changeKey.length; i++){
				var projectItem = getActorClipWithTreePath(actorName, changeKey[i]);
				var path = changeMediaPath[i];
				if(osIsWin){
					path = path.replace(/\//g, '\\');
				}
				projectItem.changeMediaPath(path, false);
				progressValueMessage('#busy_progress', i);
			}
		}
	},

	RemoveActorProjectItem : function(actorName, treePaths){
		treePaths = treePaths.split('\n');
		var garbageBin = app.project.rootItem.createBin('forDelete');
		for(var i = 0; i < treePaths.length; i++){
			var projectItem = getActorClipWithTreePath(actorName, treePaths[i]);
			if(projectItem){
				projectItem.moveBin(garbageBin);
			}
		}
		garbageBin.deleteBin();
	},

	MessageInfo : function(message) {
		app.setSDKEventMessage('2dActorTools:' + message, 'info');
	},
	MessageWarning : function(message) {
		app.setSDKEventMessage('2dActorTools:' + message, 'warning');
	},
	MessageError : function(message){
		app.setSDKEventMessage('2dActorTools:' + message, 'error');
	}
};

function shallowSearch(root, name, projectItemType) {
	for(var i = 0; i < root.children.numItems; i++) {
		if(root.children[i].type === projectItemType && root.children[i].name === name) {
			return root.children[i];
		}
	}
	return null;
}

function shallowSearchWithMediaPath(root, mediaPath, projectItemType) {
	for(var i = 0; i < root.children.numItems; i++) {
		if(root.children[i].type === projectItemType && root.children[i].getMediaPath() === mediaPath) {
			return root.children[i];
		}
	}
	return null;
}

function searchItemWithTreePath (treePath, type) {
    var sepIndex = treePath.indexOf('/', 0);
    var oldIndex = 0;
	var root = app.project.rootItem;
    while(sepIndex !== -1){
		var binName = treePath.slice(oldIndex, sepIndex);
        root = shallowSearch(root, binName, ProjectItemType.BIN);
        if(!root) return null;
        oldIndex = sepIndex + 1;
        sepIndex = treePath.indexOf('/', sepIndex + 1);
    }
    if(root && oldIndex < treePath.length){
		return shallowSearch(root, treePath.slice(oldIndex), type);
	}
    return null;
}

function searchActBin(){
	if (app.project && !ActorBinItem) {
		var projectItems = app.project.rootItem.children;
		for(var i = 0; i < projectItems.numItems; i++) {
			if(projectItems[i].type === ProjectItemType.BIN && projectItems[i].name === ACT_BIN_NAME) {
				ActorBinItem = projectItems[i];
				break;
			}
		}
	}
}

function getClipAtTime(trackItemList, time){
	for(var i = 0; i < trackItemList.length; i++){
		if(trackItemList[i].start.seconds <= time && time < trackItemList[i].end.seconds){
			return trackItemList[i];
		}
	}
	return null;
}
function getTrackItemAtTime(trackItems, time){
	for(var i = 0; i < trackItems.numItems; i++) {
		if(trackItems[i].inPoint.seconds <= time && time < trackItems[i].outPoint.seconds){
			return trackItems[i];
		}
	}
	return null;
}

function getClipLocalTime (clip, time) {
	return time + clip.inPoint.seconds - clip.start.seconds;
}

function getNextClipTime(clips, endFlag, startSeconds, endSeconds, epsTime) {
	var halfTime = epsTime / 2;
    var i = clips.numItems - 1;
    if(endFlag & ACT_CLIPEND_END) {
        for(; i >= 0 ; i--){
            if(startSeconds < clips[i].end.seconds - halfTime) {
                endSeconds = Math.min(endSeconds, clips[i].end.seconds);
            } else {
                i = Math.min(i + 1, clips.numItems - 1);
                break;
            }
        }
    }
    if(endFlag & ACT_CLIPEND_START) {
        for(; i >= 0 ; i--){
            if(startSeconds < clips[i].start.seconds - halfTime) {
                endSeconds = Math.min(endSeconds, clips[i].start.seconds);
            } else {
                break;
            }
        }
    }
    return endSeconds;
}

function getNextMarkerTime(markers, startSeconds, endSeconds) {
    for(var i = markers.numMarkers - 1; i >= 0 ; i--){
        if(startSeconds < markers[i].start.seconds) {
            if(startSeconds < markers[i].start.seconds) {
                endSeconds = Math.min(endSeconds, markers[i].start.seconds);
            } else {
                break;
            }
        }
        if(markers[i].end.seconds < startSeconds) {
            if(startSeconds < markers[i].end.seconds) {
                endSeconds = Math.min(endSeconds, markers[i].end.seconds);
            } else {
                break;
            }
        }
    }
    return endSeconds;
}

function getActorClipWithTreePath(actorName, treePath) {
	return searchItemWithTreePath(ActorBinItem.name + '/' + actorName + '/' + treePath, ProjectItemType.CLIP);
}

function getDummyClip() {
	return shallowSearch(ActorBinItem, 'dummy.png', ProjectItemType.CLIP);
}

function getComponentObject(clip, componentName) {
	var component = null;
	for(var i = 0; i < clip.components.numItems; i++) {
		if(clip.components[i].displayName === componentName) {
			component = clip.components[i];
		}
	}
	return component;
}

function getPropertyObject (component, propertyNames) {
	var propertyRoot = component;
	for(var i = 0; i < propertyNames.length; i++) {
		var propertyName = propertyNames[i];
		for(var j = 0; j < propertyRoot.properties.numItems; j++){
			if(propertyRoot.properties[j].displayName === propertyName) {
				propertyRoot = propertyRoot.properties[j];
				break;
			}
		}
	}
	return propertyRoot;
}

function getSourceTextParam(mogrtComponent){
	var sourceText = mogrtComponent.properties.getParamForDisplayName(DISPLAY_NAME_SRC_TEXT_V1);
	if(!sourceText) sourceText = mogrtComponent.properties.getParamForDisplayName(DISPLAY_NAME_SRC_TEXT_V2);
	return sourceText;
}

function getSequenceTrackItemsInSequence(parentSequence, targetSequenceID){
	var sequenceList = [];
	for(var i = 0; i < parentSequence.videoTracks.numTracks; i++){
		var clips = parentSequence.videoTracks[i].clips;
		for(var j = 0; j < clips.numItems; j++){
			if(clips[j].projectItem && clips[j].projectItem.isSequence()){
				var seq = trackItemToSequence(clips[j]);
				if(seq.sequenceID === targetSequenceID){
					sequenceList.push(clips[j]);
				}
			}
		}
	}
	
	sequenceList.sort(function(a, b) {
		return a.start.seconds - b.start.seconds;
	});
	return sequenceList;
}

function getParentBin(projectItem){
	var treePath = removeRootPath(projectItem.treePath);
	var index = treePath.lastIndexOf('/');
	if(index !== -1) {
		treePath = treePath.slice(0, index);
		return searchItemWithTreePath(treePath, ProjectItemType.BIN);
	} else {
		return app.project.rootItem;
	}
}

function fixTimeError(seconds, epsTime) {
    var mod = (seconds % epsTime);
    if(mod * 2 < epsTime) {
        seconds -= mod;
    } else {
        seconds += epsTime - mod;
    }
    return seconds;
}

function castBBoxListToNumber(bbox_list){
	bbox_list = bbox_list.split('\n');
	var _bbox_list = [];
	for(var i = 0; i < bbox_list.length; i++){
		var bbox = bbox_list[i].split(',');
		_bbox_list[i] = [Number(bbox[0]), Number(bbox[1]), Number(bbox[2]), Number(bbox[3])];
	}
	return _bbox_list;
}

function getOuterBBox(bbox_list){
	var total_l = bbox_list[0][0];
	var total_t = bbox_list[0][1];
	var total_r = total_l + bbox_list[0][2];
	var total_b = total_t + bbox_list[0][3];
	for(var i = 1; i < bbox_list.length; i++){
		var l = bbox_list[i][0];
		var t = bbox_list[i][1];
		var r = l + bbox_list[i][2];
		var b = t + bbox_list[i][3];
		if(l < total_l) total_l = l;
		if(t < total_t) total_t = t;
		if(r > total_r) total_r = r;
		if(b > total_b) total_b = b;
	}
	return [total_l, total_t, total_r - total_l, total_b - total_t]
}

function trackItemToSequence(clip) {
	if(clip.projectItem){
		for(var i = 0; i < app.project.sequences.numSequences; i++){
			if(app.project.sequences[i].projectItem !== null && clip.projectItem.nodeId === app.project.sequences[i].projectItem.nodeId){
				return app.project.sequences[i];
			}
		}
	}
    return null;
}

function overwriteVideoClip(projectItem, sequence, track, startTime, endFlag, endMarkerSequence, l, t, w, h, actor_l, actor_t){
	var clips = track.clips;
	var epsTime = sequence.getSettings().videoFrameRate.seconds;
	var endTime = startTime + 60 * 60;
	if(sequence.getOutPointAsTime().seconds > 0) {
		endTime = sequence.getOutPointAsTime().seconds;
	}

	endTime = getNextClipTime(clips, endFlag, startTime, endTime, epsTime);
	if(endFlag & ACT_CLIPEND_MARKER) {
		endTime = getNextMarkerTime(endMarkerSequence.markers, startTime, endTime);
	}
	
	if(!projectItem.isSequence()) projectItem.setOverrideFrameRate(1/epsTime);

	var correctionTime = epsTime / 100;
	var _startTime = new Time();
	_startTime.seconds = fixTimeError(startTime, epsTime) + correctionTime;
	var _endTime = new Time();
	_endTime.seconds = fixTimeError(endTime, epsTime) + correctionTime;

	projectItem.setInPoint(_startTime, 4);
	projectItem.setOutPoint(_endTime, 4);
	track.overwriteClip(projectItem, startTime);
	if(!projectItem.isSequence()) projectItem.setOverrideFrameRate(0);

	if(l !== undefined && t !== undefined && w !== undefined && h !== undefined && w > 0 && h > 0){
		var settings = sequence.getSettings();
		var clip_bbox = [l, t, w, h];
		var sequence_bbox = [actor_l, actor_t, settings.videoFrameWidth, settings.videoFrameHeight];
		var searchIndex = track.clips.numItems - 1;
		var halfEpsTime = epsTime * 0.5;
		for(var i = searchIndex; i >= 0 ; i--){
			if(Math.abs(track.clips[i].start.seconds - startTime) < halfEpsTime) {
				anchorUpdate(track.clips[i], clip_bbox, sequence_bbox, 1);
				break;
			}
		}
	}
}

function makeVideoTrack(sequence, trackIndex) {
	if(trackIndex >= sequence.videoTracks.numTracks) {
		var lastIndex = sequence.videoTracks.numTracks - 1;
		var vlocked = sequence.videoTracks[lastIndex].isLocked();
		if(!vlocked) {
			sequence.videoTracks[lastIndex].setLocked(1);
		}
		var currentTrackNum = sequence.videoTracks.numTracks;
		var clip = getDummyClip();
		for(var i = trackIndex - currentTrackNum; i >= 0; i--) {
			sequence.videoTracks[sequence.videoTracks.numTracks - 1].overwriteClip(clip, 0);
			sequence.videoTracks[sequence.videoTracks.numTracks - 1].setLocked(1);
		}
		for(var i = Number(currentTrackNum); i < sequence.videoTracks.numTracks; i++) {
			sequence.videoTracks[i].setLocked(0);
			sequence.videoTracks[i].clips[0].setSelected(true, false);
			sequence.videoTracks[i].clips[0].remove(false, false);
		}
		if(!vlocked) {
			sequence.videoTracks[lastIndex].setLocked(0);
		}
	}
}

function updateUI(properties){
	var property = null;
	for(var i = 0; i < properties.length; i++){
		if(properties[i] === null) continue;
		property = properties[i];
		break;
	}
	if(property === null) return;

	if(property.isTimeVarying()){
		var time = new Time();
		time.seconds = -1;
		var keyTime = property.findNextKey(time);
		var value = property.getValueAtKey(keyTime);
		property.setValueAtKey(keyTime, value, true);
	} else {
		var value = property.getValue();
		property.setValue(value, true);
	}
}

function anchorUpdate(clip, clip_bbox, sequence_bbox, updateUI){
	var component = getComponentObject(clip, DISPLAY_NAME_MOTION);
	var property = getPropertyObject(component, [DISPLAY_NAME_ANCHORPOINT]);
	var newX = (sequence_bbox[2] * 0.5 - clip_bbox[0] + sequence_bbox[0]) / clip_bbox[2];
	var newY = (sequence_bbox[3] * 0.5 - clip_bbox[1] + sequence_bbox[1]) / clip_bbox[3];
	property.setValue([newX, newY], updateUI);
}

function initializeActBin(extPath){
	searchActBin();
	if(!ActorBinItem){
		ActorBinItem = app.project.rootItem.createBin(ACT_BIN_NAME);
	}
	var dummyClip = shallowSearch(ActorBinItem, 'dummy.png', ProjectItemType.CLIP);
	if(dummyClip === null) app.project.importFiles([extPath + '/resource/dummy.png'], true, ActorBinItem, false);
}

function getFirstSequenceFromTrackItems(clips) {
	// todo animation sequence check
	var seq = null;
	for(var i = 0; i < clips.numItems; i++) {
		if(clips[i].projectItem && clips[i].projectItem.isSequence()) {
			seq = trackItemToSequence(clips[i]);
		}
	}
	return seq;
}

function getTreePathFromActorClip(clip){
	var treePath = '';
	if(clip.projectItem && !clip.projectItem.isSequence()){
		treePath = clip.projectItem.treePath;
	}
	return treePath.slice(1 + treePath.indexOf('\\', 1 + treePath.indexOf('\\', 1 + treePath.indexOf('\\', 1)))).replace(/\\/g, '/');
}

function changeExt(path, new_ext){
	return path.substring(0, path.lastIndexOf(".")) + new_ext;
}

function removeRootPath(treePath) {
	treePath = treePath.replace(/\\/g, '/');
	var rootPath = app.project.rootItem.treePath.replace(/\\/g, '/');
	if(treePath.indexOf(rootPath) === 0){
		treePath = treePath.slice(rootPath.length + 1);
	}
	return treePath;
}

/******************** Animation *********************/
function getTransition(targetMarker){
	var transition = [];
	var infoList = targetMarker.comments.split('\n');
	var indexes = infoList[2].split(',');
	var durations = infoList[3].split(',');

	transition.push(new FrameAnimationKey(Number(indexes[indexes.length - 1]), Number(durations[durations.length - 1])));
	indexes = infoList[0].split(',');
	durations = infoList[1].split(',');
	for(var i = 0; i < indexes.length; i++) {
		transition.push(new FrameAnimationKey(Number(indexes[i]), Number(durations[i])));
	}

	return transition;
}

function getRandomInfo(targetMarker){
	var infoList = targetMarker.comments.split('\n');
	var random_info = infoList[4].split(',');

	return random_info;
}

function getTransitionForClipset(sequence, targetMarker){
	var infoList = targetMarker.comments.split('\n');
	var transition = getTransition(targetMarker);
	
	var treePathList = [];
	var frameList = [];
	for(var i = 0; i < transition.length; i++){
		treePathList.push(getTreePathFromActorClip(sequence.videoTracks[transition[i].index].clips[0]));
		frameList.push(Math.round(transition[i].duration * 60));
	}

	var result = '{"anim_clips":"' + treePathList.join(',') + '","frame":"' + frameList.join(',') + '"';
	if(infoList.length >= 5){
		var randomInfo = infoList[4].split(',');
		result += ',"interval":"' + randomInfo[0].toString() + '","range":"' + randomInfo[1].toString() + '"';
	}

	result += '}';
	return result;
}

function switchActiveTrack(fAnimationProperties, activateSeconds, activateTrackIndex, deactivateTrackIndex, epsTime) {
	activateSeconds = fixTimeError(activateSeconds, epsTime);
	var lastTime = new Time();
	lastTime.seconds = fixTimeError(activateSeconds - epsTime, epsTime);
	var activateTime = new Time();
	activateTime.seconds = fixTimeError(activateSeconds, epsTime);

	if(deactivateTrackIndex < 0) {
		for(var i = 0; i < fAnimationProperties.length; i++){
			if(fAnimationProperties[i] === null || activateTrackIndex === i) continue;
			var prevKeyTime = fAnimationProperties[i].findPreviousKey(activateTime);
			if(prevKeyTime !== undefined){
				var lastValue = fAnimationProperties[i].getValueAtKey(prevKeyTime);
				if(lastValue == 100) {
					deactivateTrackIndex = i;
					break;
				}
			}
		}
	}

	if(deactivateTrackIndex >= 0){
		var deactivateProperty = fAnimationProperties[deactivateTrackIndex];
		if(deactivateProperty !== null) {
			var prevKeyTime = deactivateProperty.findPreviousKey(activateTime);
			if(prevKeyTime !== undefined){
				var lastValue = deactivateProperty.getValueAtKey(prevKeyTime);
				deactivateProperty.addKey(lastTime);
				deactivateProperty.setValueAtKey(lastTime, lastValue, 0);
			}
			deactivateProperty.addKey(activateTime);
			deactivateProperty.setValueAtKey(activateTime, 0, 0);
		}
	}

	var activateProperty = fAnimationProperties[activateTrackIndex];
	if(activateProperty !== null){
		var prevKeyTime = activateProperty.findPreviousKey(activateTime);
		if(prevKeyTime !== undefined){
			var lastValue = activateProperty.getValueAtKey(prevKeyTime);
			activateProperty.addKey(lastTime);
			activateProperty.setValueAtKey(lastTime, lastValue, 0);
		}
		activateProperty.addKey(activateTime);
		activateProperty.setValueAtKey(activateTime, 100, 0);
	}
}

function clearFrameAnimation(animationSequence, fAnimationProperties, start, end, restoreChangeMarker) {
	var epsTime = animationSequence.getSettings().videoFrameRate.seconds;
	var startTime = new Time();
	startTime.seconds = fixTimeError(start, epsTime);
	var endTime = new Time();
	endTime.seconds = fixTimeError(end, epsTime);
	for(var i = 0; i < fAnimationProperties.length; i++){
		if(fAnimationProperties[i]){
			var value = fAnimationProperties[i].getValueAtKey(endTime);
			if(value !== null){
				var endNextTime = new Time();
				endNextTime.seconds = fixTimeError(endTime.seconds + epsTime, epsTime);
				var nextValue = fAnimationProperties[i].getValueAtKey(endNextTime);
				if(nextValue !== null){
					fAnimationProperties[i].removeKey(endNextTime);
				}
			}
			fAnimationProperties[i].removeKeyRange(startTime, endTime);
		}
	}

	if(start < epsTime){
		var initMarker = getFirstTransitionMarker(animationSequence.markers);
		if(initMarker){
			var initTransition = getTransition(initMarker);
			setInitialKey(AnimationProperties, initTransition);
		}
	}

	if(!restoreChangeMarker) return;

	// Restore change marker
	var markers = animationSequence.markers;
	var nextMarker = getFirstTransitionMarker(markers);
	while(nextMarker !== null && nextMarker.start.seconds < startTime.seconds){
		nextMarker = getNextTransitionMarker(markers, nextMarker);
	}
	var currentMarker = null;

	var prevIndex = -1;
	var currentTransition = null;
	while(true){
		if(HasPassedMarkerChangeTime(endTime.seconds, nextMarker)) {
			currentMarker = nextMarker;
			if(currentMarker !== null) {
				currentTransition = getTransition(currentMarker);
				nextMarker = getNextTransitionMarker(markers, currentMarker);
			}
			switchActiveTrack(fAnimationProperties, currentMarker.start.seconds , currentTransition[0].index, prevIndex, epsTime);
		} else {
			break;
		}
	}
}

function fixWrongKey(properties, time, epsTime){
	var _time = new Time();
	_time.seconds = time;
	var lastTime = null;
	for(var i = 0; i < properties.length; i++){
		var property = properties[i];
		if(property){
			var hasKey = property.getValueAtKey(_time);
			if(hasKey === null){
				lastTime = property.findPreviousKey(_time);
			}else{
				lastTime = new Time();
				lastTime.seconds = _time.seconds;
			}
			var nextKeyTime = property.findNextKey(_time);

			if(lastTime && nextKeyTime && (nextKeyTime.seconds - lastTime.seconds) > epsTime * 1.5){
				var lastValue = property.getValueAtKey(lastTime);
				var nextValue = property.getValueAtKey(nextKeyTime);
				if(lastValue !== nextValue){
					lastTime.seconds = fixTimeError(nextKeyTime.seconds - epsTime, epsTime);
					property.addKey(lastTime);
					property.setValueAtKey(lastTime, lastValue, 0);
				}
			}
		}
	}
}

function initializeKey(property, init){
	if(property === null) return;
	if (property.isTimeVarying()) {
		property.setTimeVarying(false);
	}
	property.setTimeVarying(true);
		
	var startTime = new Time();
	startTime.seconds = 0;
	property.addKey(startTime);
	property.setValueAtKey(startTime, init, 0);
}

function setInitialKey(animationProperties, transition){
	var time = new Time();
	time.seconds = 0;
	for(var i = 0; i < animationProperties.length; i++){
		if(animationProperties[i]){
			var value = transition[0].index === i ? 100 : 0;
			animationProperties[i].addKey(time);
			animationProperties[i].setValueAtKey(time, value, 0);
		}
	}
}

function HasPassedMarkerChangeTime(time, nextMarker) {
	if(nextMarker !== null) {
		return nextMarker.start.seconds <= time;
	}
	return false;
}

function bakeFrameAnimation_Audio(allDuration, animationKeypoints, animationStartTimeList, id){
	var epsTime = fAnimationSequence.getSettings().videoFrameRate.seconds;
	var markers = fAnimationSequence.markers;

	if(markers.numMarkers == 0) return;
	var currentMarker = getFirstTransitionMarker(markers);
	var nextMarker = null;
	var currentTransition = null;
	var targetTime = 0;
	var currentTransitionOutDuration = 0;

	nextMarker = getNextTransitionMarker(markers, currentMarker);

	var ChangeNextTransition = function(currentLevel){
		currentMarker = nextMarker;
		if(currentMarker !== null) {
			var prevLength = currentTransition.length;
			currentTransition = getTransition(currentMarker);
			nextMarker = getNextTransitionMarker(markers, currentMarker);
			currentLevel = Math.floor(currentLevel * currentTransition.length / prevLength);
			return currentLevel;
		}
		return 0;
	}

	var LevelRestriction = function(){
		timeToClose = 0;
		for(var levelItr = 1; levelItr <= level; levelItr++) {
			timeToClose += currentTransition[levelItr].duration;
			if(targetTime + timeToClose >= limitTime || targetTime + timeToClose + currentTransition[0].duration >= clipEnd){
				level = levelItr;
				break;
			}
		}
	}

	var sequenceList = getSequenceTrackItemsInSequence(linkSequenceParents[fLinkedSequenceIndex], linkSequence[fLinkedSequenceIndex].sequenceID);
	var finalKey = {};
	if(allDuration){
		currentTransition = getTransition(currentMarker);
		finalKey[Math.round(currentMarker.start.seconds / epsTime)] = currentTransition[0].index;
	}

	var endTimeList = [];
	for(var clipIndex = 0; clipIndex < fAnimationSourceClipsLength; clipIndex++) {
		if(id){
			if(clipIndex % 10 == 0){
				bakeValueMessage(id, clipIndex);
			}
		}
		var clipStart = fAnimationSourceClips[clipIndex].start.seconds;
		var targetSequence = getClipAtTime(sequenceList, clipStart);
		if(targetSequence === null) continue;
		clipStart = getClipLocalTime(targetSequence, clipStart);
		var clipEnd = getClipLocalTime(targetSequence, fAnimationSourceClips[clipIndex].end.seconds - epsTime * 2);
		var clipInPoint = fAnimationSourceClips[clipIndex].inPoint.seconds;
		var keypoints = animationKeypoints[clipIndex].split(',');
		var startTime = animationStartTimeList[clipIndex].split(',');

		if(!allDuration){
			clearFrameAnimation(fAnimationSequence, AnimationProperties, clipStart, clipEnd + epsTime, false);
			while(true){
				if(HasPassedMarkerChangeTime(clipStart, nextMarker)) {
					currentMarker = nextMarker;
					nextMarker = getNextTransitionMarker(markers, currentMarker);
					if(currentMarker.start.seconds >= clipStart){
						currentTransition = getTransition(currentMarker);
						finalKey[Math.round(currentMarker.start.seconds / epsTime)] = currentTransition[0].index;
					}
				} else {
					break;
				}
			}
		}

		currentTransition = getTransition(currentMarker);
		var level = 1;
		for(var i = 0; i < startTime.length; i++) {
			level = Math.max(level, 0);
			var offset = Number(startTime[i]) - clipInPoint;
			if(offset < 0) continue;

			targetTime = Math.max(clipStart + offset, clipStart + epsTime);
			var limitTime = clipEnd;
			if(i < startTime.length - 1) {
				limitTime = Math.min(clipStart + Number(startTime[i + 1]) - clipInPoint, limitTime);
			}
			if(targetTime >= limitTime){
				continue;
			} 

			if(keypoints[i] == 1) {
				level = Math.max(level, 1);
				while(true){
					if(HasPassedMarkerChangeTime(targetTime, nextMarker)) {
						ChangeNextTransition(0);
						finalKey[Math.round(currentMarker.start.seconds / epsTime)] = currentTransition[0].index;
					} else {
						break;
					}
				}
				
				// transition in
				var timeToClose = 0;
				for(; level < currentTransition.length; level++) {
					targetTime = fixTimeError(targetTime, epsTime);
					if(HasPassedMarkerChangeTime(targetTime, nextMarker)) {
						level = ChangeNextTransition(level);
						level = Math.max(level, 1);
						LevelRestriction();
					}
					finalKey[Math.round(targetTime / epsTime)] = currentTransition[level].index;
					targetTime += currentTransition[level].duration;
					timeToClose += currentTransition[level].duration;
					if(targetTime + timeToClose >= limitTime) {
						break;
					}
				}
				level = Math.min(level, currentTransition.length - 1);
				LevelRestriction();

				var currentTransitionOutDuration = 0;
				for(var j = 0; j < currentTransition.length - 1; j++) {
					currentTransitionOutDuration += currentTransition[j].duration;
				}
				targetTime = Math.max(targetTime, limitTime - currentTransitionOutDuration);

				// mid test
				while(true){
					if(HasPassedMarkerChangeTime(targetTime, nextMarker)) {
						level = ChangeNextTransition(level);
						level = Math.max(level, 1);
						LevelRestriction();
						finalKey[Math.round(currentMarker.start.seconds / epsTime)] = currentTransition[level].index;
					} else {
						break;
					}
				}

				// transition out
				level = Math.min(level, currentTransition.length - 2);
				for(; level >= 0; level--) {
					targetTime = fixTimeError(targetTime, epsTime);
					if(HasPassedMarkerChangeTime(targetTime, nextMarker)) {
						level = ChangeNextTransition(level);
						LevelRestriction();
					}
					if(targetTime <= limitTime){
						finalKey[Math.round(targetTime / epsTime)] = currentTransition[level].index;
						targetTime += currentTransition[level].duration;
					} else {
						break;
					}
				}
			} else {					
				level = Math.min(level, currentTransition.length - 2);
				for(; level >= 0; level--) {
					targetTime = fixTimeError(targetTime, epsTime);
					if(HasPassedMarkerChangeTime(targetTime, nextMarker)) {
						level = ChangeNextTransition(level);
						LevelRestriction();
					}
					if(targetTime + currentTransition[level].duration < limitTime){
						finalKey[Math.round(targetTime / epsTime)] = currentTransition[level].index;
						targetTime += currentTransition[level].duration;
					} else {
						break;
					}
				}
			}
		}
		// force close
		clipEnd = clipEnd + epsTime;
		finalKey[Math.round(clipEnd / epsTime)] = currentTransition[0].index;
		if(!allDuration) endTimeList.push(clipEnd);
	}

	if(allDuration){
		// Check for marker changes until end.
		while(true){
			ChangeNextTransition(0);
			if(currentMarker === null) break;
			finalKey[Math.round(currentMarker.start.seconds / epsTime)] = currentTransition[0].index;
		}
	}

	var prevIndex = -1;
	var size = 0;
	if(id){
		for(var key in finalKey) {
			size++;
		}
		size = Math.max(Math.floor(size / 100), 1);
		bakeTextMessage(id, BAKE_ANIMATION_AUDIO_MESSAGE2);
		bakeMaxMessage(id, size);
		bakeValueMessage(id, 0);
	}

	var count = 0;
	for(var key in finalKey) {
		if(finalKey[key] !== prevIndex) {
			switchActiveTrack(AnimationProperties, Number(key) * epsTime, finalKey[key], prevIndex, epsTime);
			prevIndex = finalKey[key];
		}
		if(id){
			count++;
			if(count % 100 === 0){
				bakeValueMessage(id, Math.floor(count / 100));
			}
		}
	}

	if(!allDuration){
		for(var i = 0; i < fAnimationSourceClipsLength; i++) {
			fixWrongKey(AnimationProperties, endTimeList[i], epsTime);
		}
	}

	updateUI(AnimationProperties);

	if(id){
		bakeCompleteMessage(id);
	}
}

/* 
	Parameters
	----------
	endTime
		charactor sequence local time
*/
function bakeFrameAnimationSimple(clips, linkedSequenceIndex, animationTrackIndex, endTime){
	var animationSequence = linkAnimationSequence[linkedSequenceIndex][animationTrackIndex];
	var animationProperties = linkAnimationProperties[linkedSequenceIndex][animationTrackIndex];
	var epsTime = animationSequence.getSettings().videoFrameRate.seconds;
	var markers = animationSequence.markers;

	if(markers.numMarkers == 0) return;
	var currentMarker = getFirstTransitionMarker(markers);
	var nextMarker = null;
	var currentTransition = null;

	nextMarker = getNextTransitionMarker(markers, currentMarker);

	var ChangeNextTransition = function(){
		currentMarker = nextMarker;
		if(currentMarker !== null) {
			currentTransition = getTransition(currentMarker);
			nextMarker = getNextTransitionMarker(markers, currentMarker);
		}
	}

	// todo first marker
	var sequenceList = getSequenceTrackItemsInSequence(linkSequenceParents[linkedSequenceIndex], linkSequence[linkedSequenceIndex].sequenceID);
	var finalKey = {};

	for(var clipIndex = 0; clipIndex < clips.length; clipIndex++) {
		if(endTime && endTime < clips[clipIndex].end.seconds) break;
		var clipStart = clips[clipIndex].start.seconds;
		var targetSequence = getClipAtTime(sequenceList, clipStart);
		if(targetSequence === null) continue;
		clipStart = getClipLocalTime(targetSequence, clipStart + epsTime);
		var clipEnd = getClipLocalTime(targetSequence, clips[clipIndex].end.seconds - epsTime * 1);

		currentTransition = getTransition(currentMarker);

		while(true){
			if(HasPassedMarkerChangeTime(clipStart, nextMarker)) {
				ChangeNextTransition();
				finalKey[Math.round(currentMarker.start.seconds / epsTime)] = currentTransition[0].index;
			} else {
				break;
			}
		}
		finalKey[Math.round(clipStart / epsTime)] = currentTransition[currentTransition.length - 1].index;
		finalKey[Math.round(clipEnd / epsTime)] = currentTransition[0].index;
	}

	var prevIndex = -1;
	for(var key in finalKey) {
		if(finalKey[key] !== prevIndex) {
			switchActiveTrack(animationProperties, Number(key) * epsTime, finalKey[key], prevIndex, epsTime);
			prevIndex = finalKey[key];
		}
	}
	updateUI(animationProperties);
}

function bakeFrameAnimation_Random(start, end, clearKeyframe, once, id){
	var epsTime = fAnimationSequence.getSettings().videoFrameRate.seconds;
	var markers = fAnimationSequence.markers;

	if(markers.numMarkers <= 1) return;
	var currentMarker = getFirstTransitionMarker(markers);
	var nextMarker = getNextTransitionMarker(markers, currentMarker);
	var currentTransition = null;
	var targetTime = 0;
	var prevIndex = -1;
	var period = Number(epsTime);
	var randomlyRange = 0;

	while(true){
		if(HasPassedMarkerChangeTime(start, nextMarker)) {
			currentMarker = nextMarker;
			nextMarker = getNextTransitionMarker(markers, currentMarker);
		} else {
			break;
		}
	}

	currentTransition = getTransition(currentMarker);
	var randomInfo = getRandomInfo(currentMarker);
	period = Number(randomInfo[0]);
	randomlyRange = Number(randomInfo[1]);
	if(clearKeyframe){
		clearFrameAnimation(fAnimationSequence, AnimationProperties, start, end, false);
		switchActiveTrack(AnimationProperties, start, currentTransition[0].index, prevIndex, epsTime);
	}

	var ChangeNextTransition = function(currentLevel){
		currentMarker = nextMarker;
		if(currentMarker !== null) {
			var prevLength = currentTransition.length;
			currentTransition = getTransition(currentMarker);
			var randomInfo = getRandomInfo(currentMarker);
			period = Number(randomInfo[0]);
			randomlyRange = Number(randomInfo[1]);
			nextMarker = getNextTransitionMarker(markers, currentMarker);
			currentLevel = Math.floor(currentLevel * currentTransition.length / prevLength);
			return currentLevel;
		}
		return 0;
	}

	targetTime = Math.max(epsTime * 2, Number(start) + period + (Math.random() * 2 - 1) * randomlyRange);
	while(targetTime < end) {
		if(id){
			bakeValueMessage(id, targetTime - start);
		}
		while(true){
			if(HasPassedMarkerChangeTime(targetTime, nextMarker)) {
				ChangeNextTransition(0);
				switchActiveTrack(AnimationProperties, currentMarker.start.seconds, currentTransition[0].index, prevIndex, epsTime);
				prevIndex = currentTransition[0].index;
			} else {
				break;
			}
		}
		// transition in
		for(var i = 1; i < currentTransition.length; i++) {
			targetTime = fixTimeError(targetTime, epsTime);
			if(HasPassedMarkerChangeTime(targetTime, nextMarker)) {
				i = ChangeNextTransition(i);
				i = Math.max(i, 1);
			}
			switchActiveTrack(AnimationProperties, targetTime, currentTransition[i].index, prevIndex, epsTime);			
			prevIndex = currentTransition[i].index;
			targetTime += currentTransition[i].duration;
		}
	
		// transition out
		for(var i = currentTransition.length - 2; i >= 0; i--) {
			targetTime = fixTimeError(targetTime, epsTime);
			if(HasPassedMarkerChangeTime(targetTime, nextMarker)) {
				i = ChangeNextTransition(i);
			}
			switchActiveTrack(AnimationProperties, targetTime, currentTransition[i].index, prevIndex, epsTime);			
			prevIndex = currentTransition[i].index;
			targetTime += currentTransition[i].duration;
		}
		if(once) break;
		targetTime += Math.max(epsTime * 2, period + (Math.random() * 2 - 1) * randomlyRange);
	}

	if(clearKeyframe){
		end = end + epsTime;
		while(true){
			if(HasPassedMarkerChangeTime(end, nextMarker)) {
				ChangeNextTransition(0);
				switchActiveTrack(AnimationProperties, currentMarker.start.seconds, currentTransition[0].index, prevIndex, epsTime);
				prevIndex = currentTransition[0].index;
			} else {
				break;
			}
		}
	}

	fixWrongKey(AnimationProperties, end, epsTime);

	updateUI(AnimationProperties);

	if(id){
		bakeCompleteMessage(id);
	}
}

function getFirstTransitionMarker(markers) {
	var marker =  markers.getFirstMarker();
	do {
		if(isTransitionMarker(marker)) {
			return marker;
		}
		marker = getNextTransitionMarker(markers, marker);
	} while(marker !== null);
	return null;
}

function getNextTransitionMarker(markers, currentMarker){
	var endMarker = markers.getLastMarker();

	while(currentMarker.guid !== endMarker.guid){
		currentMarker = markers.getNextMarker(currentMarker);
		if(isTransitionMarker(currentMarker)) {
			return currentMarker;
		}
	}
	return null;
}

function isTransitionMarker(marker){
	return marker.type === 'Segmentation' && marker.name === TRANSITION_MARKER_NAME;
}

function getTransitionMarkerAtTime(markers, seconds) {
	if(markers.numMarkers > 0) {
		var currentMarker = markers.getFirstMarker();
		if(!isTransitionMarker(currentMarker)){
			currentMarker = getNextTransitionMarker(markers, currentMarker);
		}
		while(currentMarker !== null) {
			if(currentMarker.start.seconds <= seconds && seconds < currentMarker.end.seconds){
				return currentMarker;
			}
			currentMarker = getNextTransitionMarker(markers, currentMarker);
		}
	}
	return null;
}

function getAnimationSequenceLinkInfo(sequence){
	if(sequence.markers.numMarkers > 0) {
		var currentMarker = sequence.markers.getFirstMarker();
		var endMarker = sequence.markers.getLastMarker();
		while(true){
			if(currentMarker.type === 'Comment' && currentMarker.getColorByIndex() === ANIMATION_SEQUENCE_LINK_MARKER_COLOR) {
				return currentMarker.comments.split('\n');
			}
			if(currentMarker.guid !== endMarker.guid) {
				currentMarker = sequence.markers.getNextMarker(currentMarker);
			} else {
				break;
			}
		}
	}
	return null;
}
function setAnimationSequenceLinkInfo(sequence, info){
	if(sequence.markers.numMarkers > 0) {
		var currentMarker = sequence.markers.getFirstMarker();
		var endMarker = sequence.markers.getLastMarker();
		while(true){
			if(currentMarker.type === 'Comment' && currentMarker.getColorByIndex() === ANIMATION_SEQUENCE_LINK_MARKER_COLOR) {
				currentMarker.comments = info.join('\n');
				return;
			}
			if(currentMarker.guid !== endMarker.guid) {
				currentMarker = sequence.markers.getNextMarker(currentMarker);
			} else {
				break;
			}
		}
	}

	var newMarker = sequence.markers.createMarker(0);
	newMarker.name = 'DO NOT CHANGE THIS MARKER!';
	newMarker.comments = info.join('\n');
	newMarker.end = 10;
	newMarker.setTypeAsComment();
	newMarker.setColorByIndex(ANIMATION_SEQUENCE_LINK_MARKER_COLOR);
}
/*****************************************/

function bakeTextMessage(id, text){
	eventObj.type = "bakeTextNotification";
	eventObj.data = id + ',' + text;
	eventObj.dispatch();
}
function bakeMaxMessage(id, max){
	eventObj.type = "bakeMaxNotification";
	eventObj.data = id + ',' + max.toString();
	eventObj.dispatch();
}
function bakeValueMessage(id, value){
	eventObj.type = "bakeValueNotification";
	eventObj.data = id + ',' + value.toString();
	eventObj.dispatch();
}
function bakeCompleteMessage(id){
	eventObj.type = "bakeCompleteNotification";
	eventObj.data = id;
	eventObj.dispatch();
}
function progressMaxMessage(id, value){
	eventObj.type = "progressMaxNotification";
	eventObj.data = id + ',' + value.toString();
	eventObj.dispatch();
}
function progressValueMessage(id, value){
	eventObj.type = "progressValueNotification";
	eventObj.data = id + ',' + value.toString();
	eventObj.dispatch();
}

function MessageInfo(message) {
    app.setSDKEventMessage('2dActorTools:' + message, 'info');
}
function MessageWarning(message) {
	app.setSDKEventMessage('2dActorTools:' + message, 'warning');
}
function MessageError(message){
	app.setSDKEventMessage('2dActorTools:' + message, 'error');
}

function reportProjectItemSelectionChanged(e) {
    var projectItems = e;
    if (projectItems){
        if (projectItems.length) {
			projectSelectionItem = projectItems[0].treePath.slice(projectItems[0].treePath.indexOf('\\', 1) + 1).replace(/\\/g, '/');
            eventObj.type = "projectItemsSelect";
            eventObj.data = projectSelectionItem;
            eventObj.dispatch();
        }
    }
}
function reportSequenceItemSelectionChanged() {
    eventObj.type = "sequenceItemsSelectChanged";
	eventObj.data = '';
    eventObj.dispatch();
}
