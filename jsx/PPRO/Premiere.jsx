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

var incrementalBakeEnable = [];
var incrementalBakeSource = [];
var incrementalBake_clips = [];

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
var fAnimationSourceSize = 0;
var AnimationProperties = null;
var bakeAllDuration = false;

var FrameAnimationKey = function(index, duration, epsTime) {
    this.index = index;
    this.duration = duration;
    this.frame = duration / epsTime;
}

var ClipForIncrementalBake = function(trackItem) {
	this.nodeId = trackItem.nodeId;
    this.start = trackItem.start.seconds;
    this.end = trackItem.end.seconds;
    this.inPoint = trackItem.inPoint.seconds;
    this.outPoint = trackItem.outPoint.seconds;
}

$._PPP_={
	Setup: function(extPath){
		if (app.project) {
			var projectItems = app.project.rootItem.children;
			var actBinExists = false;
			for(var i = 0; i < projectItems.numItems; i++) {
				if(projectItems[i].type === ProjectItemType.BIN && projectItems[i].name === ACT_BIN_NAME) {
					ActorBinItem = projectItems[i];
					actBinExists = true;
					break;
				}
			}
			
			if(!actBinExists) {
				app.project.rootItem.createBin(ACT_BIN_NAME);
				for(var i = 0; i < projectItems.numItems; i++) {
					if(projectItems[i].type === ProjectItemType.BIN && projectItems[i].name === ACT_BIN_NAME) {
						ActorBinItem = projectItems[i];
						break;
					}
				}
			}
			
			var dummyClip = shallowSearch(ActorBinItem, 'dummy.png', ProjectItemType.CLIP);
			if(dummyClip === null) app.project.importFiles([extPath + '/resource/dummy.png'], true, ActorBinItem, false);

			DummyClipNodeID =  getDummyClip().nodeId;
		}
		app.unbind('onActiveSequenceStructureChanged');
		app.bind('onActiveSequenceStructureChanged', $._PPP_.SequenceStructureChanged);

		app.unbind('onSourceClipSelectedInProjectPanel');
		app.bind('onSourceClipSelectedInProjectPanel', reportProjectItemSelectionChanged);

		app.unbind('onActiveSequenceSelectionChanged');
		app.bind('onActiveSequenceSelectionChanged', reportSequenceItemSelectionChanged);

		app.unbind('onActiveSequenceTrackItemAdded');
		//app.bind('onActiveSequenceTrackItemAdded', reportSequenceItemAdd);

		app.unbind('onActiveSequenceTrackItemRemoved');
		//app.bind('onActiveSequenceTrackItemRemoved', reportSequenceItemRemove);

		app.unbind('onActiveSequenceChanged');
		app.bind('onActiveSequenceChanged', reportSequenceChanged);
		
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
				updateEventPanel("Track target is unset.");
			}
		}
		else if(!seq)
			updateEventPanel("No active sequence.");
		else
			updateEventPanel(mgtName + " clip is not found.");
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
		return clipNames;
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
						if(properties.displayName !== DISPLAY_NAME_SRC_TEXT) {
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
		return actorStructure;
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
						if(clips[j].projectItem.isSequence()){
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

	ImportMOGRTFile: function(pathList) {
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

	GetActorStructureMediaPath: function(actorName) {
		var actBin = shallowSearch(ActorBinItem, actorName, ProjectItemType.BIN);
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

	GetActorClipMediaPath: function(actorName, treePathCSV) {
		var _treePathList = treePathCSV.split(',');
		var mediaPathList = [];
		for(var i = 0; i < _treePathList.length; i++) {
			mediaPathList.push(getActorClipWithTreePath(actorName, _treePathList[i]).getMediaPath());
		}
		return mediaPathList.join(',');
	},

	GetSettingsMediaPath: function() {
		var mediaPath = "";
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

	InsertActorClip: function(actorName, sequenceIndex, trackIndex, clipTreePath, startTime, endFlag) {
		var activeSequence = app.project.activeSequence;
		var seq = linkSequence[sequenceIndex];
		if(startTime < 0) {
			if(activeSequence) {
				var sequenceList = getSequenceTrackItemsInSequence(activeSequence, seq.sequenceID);
				var playerPosition = activeSequence.getPlayerPosition();
				var targetSequence = getClipAtTime(sequenceList, playerPosition.seconds);
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
				overwriteVideoClip(clip, seq, track, startTime, endFlag, activeSequence);
				if(deleteInsertClip) {
					var serchIndex = track.clips.numItems - 1;
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

	CreateActorSequence: function(actorName, baseClipTreePath) {
		var seqName	= prompt('Name of sequence?', actorName, 'Sequence Naming Prompt');
		if(seqName !== 'null') {
			var clip = getActorClipWithTreePath(actorName, baseClipTreePath);
			app.project.createNewSequenceFromClips(seqName, [clip], app.project.getInsertionBin());
		}
	},

	ImportActorStructureFile : function (path, actName) {
		if (app.project && path) {
			var insertBin = shallowSearch(ActorBinItem, actName, ProjectItemType.BIN);
			return app.project.importFiles([path], true, insertBin, false);
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
					clipTime = fixTimeError(clipTime, epsTime);
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

	GetSelectedSequenceTrackNum : function() {
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

	TriggerClipOverwrite : function(targetSeqFlag, trackIndex, startClipTreePath, endClipTreePath, startTriggerInsertFlag, endTriggerInsertFlag) {
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
			var startClip = searchItemWithTreePath(startClipTreePath, ProjectItemType.CLIP);
			var endClip = searchItemWithTreePath(endClipTreePath, ProjectItemType.CLIP);

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
						overwriteVideoClip(startClip, seq, targetTrack, sourceAudioClip.start.seconds, startTriggerInsertFlag, activeSeq);
					}
					if(endClip) {
						overwriteVideoClip(endClip, seq, targetTrack, sourceAudioClip.end.seconds, endTriggerInsertFlag, activeSeq);
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
	SetupAnimationMarker : function(actorName, groupName, linkedSequenceIndex, animationTrackIndex, treePathCSV){
		var treePathList = treePathCSV.split(',');
		var startTime = new Time();
		startTime.seconds = -60*60;
		var duration = new Time();
		duration.seconds = 60*60*11;
		var clips = linkSequence[linkedSequenceIndex].videoTracks[animationTrackIndex].clips;
		var seq = getFirstSequenceFromTrackItems(clips);
		var newAnimationSequence = false;

		if(seq === null) {
			var sequenceID = linkSequence[linkedSequenceIndex].sequenceID;
			for(var i = 0; i < app.project.sequences.numSequences; i++){
				var info = getAnimationSequenceLinkInfo(app.project.sequences[i]);
				if(info !== null && info[0] === sequenceID && info[1] == animationTrackIndex) {					
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
			var newMarker = seq.markers.createMarker(0);
			newMarker.name = 'DO NOT CHANGE THIS MARKER!';
			newMarker.comments = linkSequence[linkedSequenceIndex].sequenceID  + '\n' + animationTrackIndex.toString();
			newMarker.end = 10;
			newMarker.setTypeAsComment();
			newMarker.setColorByIndex(ANIMATION_SEQUENCE_LINK_MARKER_COLOR);
			var component = getComponentObject(seq.videoTracks[0].clips[0], OPACITY_COMPONENT_NAME);
			var property = getPropertyObject(component, [OPACITY_PROPERTY_NAME]);
			initializeKey(property, 100);
		}

		if(!linkAnimationSequence[linkedSequenceIndex]){
			linkAnimationSequence[linkedSequenceIndex] = [];
		}
		linkAnimationSequence[linkedSequenceIndex][animationTrackIndex] = seq;

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
				if(newAnimationSequence){
					var component = getComponentObject(seq.videoTracks[lastBlankIndex].clips[0], OPACITY_COMPONENT_NAME);
					var property = getPropertyObject(component, [OPACITY_PROPERTY_NAME]);
					initializeKey(property, 0);
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

	InsertFrameAnimationMarker : function(linkedSequenceIndex, animationTrackIndex, comment, endFlag) {
		linkedSequenceIndex = Number(linkedSequenceIndex);
		animationTrackIndex = Number(animationTrackIndex);
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
		makeVideoTrack(seq, animationTrackIndex);
		overwriteVideoClip(seq.projectItem, linkSequence[linkedSequenceIndex], track, linkedSequenceTime, endFlag, activeSequence);
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
	},

	/* 
		Parameters
		----------
		sourceClips
	 		trackItems sorted by time
	*/
	FrameAnimation_Audio : function(linkedSequenceIndex, animationTrackIndex, sourceIndex, sourceClips) {
		fLinkedSequenceIndex = linkedSequenceIndex;
		fAnimationSequenceIndex = animationTrackIndex;
		fAnimationSourceIndex = sourceIndex;
		fAnimationSequence = linkAnimationSequence[fLinkedSequenceIndex][fAnimationSequenceIndex];
		AnimationProperties = linkAnimationProperties[fLinkedSequenceIndex][fAnimationSequenceIndex];

		if(fAnimationSequence === null) {
			alert('assert');
			return;
		}

		if(sourceClips === undefined) {
			fAnimationSourceClips = linkSequenceParents[fLinkedSequenceIndex].audioTracks[sourceIndex].clips;
			fAnimationSourceClipsLength = fAnimationSourceClips.numItems;
			bakeAllDuration = true;
			initializeKey(AnimationProperties[0], 100);
			for(var i = 1; i < AnimationProperties.length; i++){
				initializeKey(AnimationProperties[i], 0);
			}
		} else {
			fAnimationSourceClips = sourceClips;
			fAnimationSourceClipsLength = fAnimationSourceClips.length;
		}

		var samplerate = (1 / 15).toString();
		fAnimationSourceSize = 0;
		fAnimationSourceCount = 0;
		for(var i = 0; i < fAnimationSourceClipsLength; i++) {
			if(fAnimationSourceClips[i].mediaType === 'Audio') {
				fAnimationSourceSize++;
			}
		}
		fAnimationKeypoints = [];
		fAnimationStartTime = [];
		for(var i = 0; i < fAnimationSourceClipsLength; i++) {
			if(fAnimationSourceClips[i].mediaType === 'Audio') {
				eventObj.type = "getAudioAnimKeyPoint";
				eventObj.data = fAnimationSourceClips[i].projectItem.getMediaPath() + ',' + samplerate + ',' + i.toString();
				eventObj.dispatch();
			}
		}
	},

	SetFrameAnimationKeypoints_Audio : function(clipIndex, keypoints, startTime) {
		fAnimationKeypoints[Number(clipIndex)] = keypoints;
		fAnimationStartTime[Number(clipIndex)] = startTime;
		fAnimationSourceCount++;
		if(fAnimationSourceCount === fAnimationSourceSize){
			bakeFrameAnimation_Audio(bakeAllDuration);
		}
	},

	FrameAnimation_Random : function(linkedSequenceIndex, animationTrackIndex) {
		var end = 0;
		fAnimationSequence = linkAnimationSequence[linkedSequenceIndex][animationTrackIndex];

		var clips = linkSequence[linkedSequenceIndex].videoTracks[animationTrackIndex].clips;
		for(var i = clips.numItems - 1; i >= 0; i--) {
			if(clips[i].projectItem.isSequence()) {
				var seq = trackItemToSequence(clips[i]);
				if(seq.sequenceID === fAnimationSequence.sequenceID){
					end = Math.max(10 * 60, clips[i].end.seconds);
					break;
				}
			}
		}

		if(fAnimationSequence === null) {
			alert('assert');
			return;
		}

		AnimationProperties = linkAnimationProperties[linkedSequenceIndex][animationTrackIndex];
		initializeKey(AnimationProperties[0], 100);
		for(var i = 1; i < AnimationProperties.length; i++){
			initializeKey(AnimationProperties[i], 0);
		}
		bakeFrameAnimation_Random(end);
	},

	SetIncrementalBakeFlag : function(linkedSequenceIndex, animationTrackIndex, sourceIndex, enable){
		enable = Number(enable);

		if(!incrementalBakeEnable[linkedSequenceIndex]){
			incrementalBakeEnable[linkedSequenceIndex] = [];
		}
		incrementalBakeEnable[linkedSequenceIndex][animationTrackIndex] = enable;

		if(enable){
			if(!incrementalBake_clips[linkedSequenceIndex]){
				incrementalBake_clips[linkedSequenceIndex] = [];
			}
			incrementalBake_clips[linkedSequenceIndex][animationTrackIndex] = [];

			if(!incrementalBakeSource[linkedSequenceIndex]){
				incrementalBakeSource[linkedSequenceIndex] = [];
			}
			incrementalBakeSource[linkedSequenceIndex][animationTrackIndex] = sourceIndex;

			var clipList = [];
			var sourceClips = linkSequenceParents[linkedSequenceIndex].audioTracks[sourceIndex].clips;
			for(var i = 0; i < sourceClips.length; i++){
				clipList.push(new ClipForIncrementalBake(sourceClips[i]));
			}
			incrementalBake_clips[linkedSequenceIndex][animationTrackIndex] = clipList;
		}

		eventObj.type = "incrementalBakeNotification";
		eventObj.data = linkedSequenceIndex.toString() + ',' + animationTrackIndex.toString() + ',' + enable.toString();
		eventObj.dispatch();
	}
};

function getClipLocalTime (clip, time) {
	return time + clip.inPoint.seconds - clip.start.seconds;
}

function getActorClipWithTreePath(actorName, treePath) {
	return searchItemWithTreePath(ActorBinItem.name + '/' + actorName + '/' + treePath, ProjectItemType.CLIP);
}

function shallowSearch(root, name, projectItemType) {
	for(var i = 0; i < root.children.numItems; i++) {
		if(root.children[i].type === projectItemType && root.children[i].name === name) {
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

function getDummyClip() {
	return shallowSearch(ActorBinItem, 'dummy.png', ProjectItemType.CLIP);
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

function trackItemToSequence(clip) {
    for(var i = 0; i < app.project.sequences.numSequences; i++){
        if(clip.projectItem.nodeId === app.project.sequences[i].projectItem.nodeId){
            return app.project.sequences[i];
        }
    }
    return null;
}

function getNextClipTime(clips, endFlag, startSeconds, endSeconds) {
    var i = clips.numItems - 1;
    if(endFlag & ACT_CLIPEND_END) {
        for(; i >= 0 ; i--){
            if(startSeconds < clips[i].end.seconds ) {
                endSeconds = Math.min(endSeconds, clips[i].end.seconds);
            } else {
                i = Math.min(i + 1, clips.numItems - 1);
                break;
            }
        }
    }
    if(endFlag & ACT_CLIPEND_START) {
        for(; i >= 0 ; i--){
            if(startSeconds < clips[i].start.seconds) {
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

function updateEventPanel(message) {
    app.setSDKEventMessage(message, 'info');
    //app.setSDKEventMessage('Here is a warning.', 'warning');
    //app.setSDKEventMessage('Here is an error.', 'error');  // Very annoying; use sparingly.
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

function reportProjectItemSelectionChanged(e) {
    var projectItems = e;
    if (projectItems){
        if (projectItems.length) {
            eventObj.type = "projectItemsSelect";
            eventObj.data = projectItems[0].treePath.slice(projectItems[0].treePath.indexOf('\\', 1) + 1).replace(/\\/g, '/');
            eventObj.dispatch();
        }
    }
}
function reportSequenceItemSelectionChanged() {
    eventObj.type = "sequenceItemsSelectChanged";
	eventObj.data = '';
    eventObj.dispatch();
}

function trackIdToIndex(track){
	var seq = app.project.activeSequence;
	if(track.mediaType === 'Audio'){
		for(var i = 0; i < seq.audioTracks.numTracks; i++){
			if(seq.audioTracks[i].id === track.id) {
				return i;
			}
		}
	} else {
		for(var i = 0; i < seq.videoTracks.numTracks; i++){
			if(seq.videoTracks[i].id === track.id) {
				return i;
			}
		}
	}
	return -1;
}

function reportSequenceChanged() {
	// Incremental Bake
	var IsDifferent = function(Ibake, trackItem){
		return (Ibake.start !== trackItem.start.seconds ||
				Ibake.end !== trackItem.end.seconds ||
				Ibake.inPoint !== trackItem.inPoint.seconds ||
				Ibake.outPoint !== trackItem.outPoint.seconds);
	}
	for(var i = 0; i < incrementalBakeEnable.length; i++){
		if(!incrementalBakeEnable[i]) continue;
		for(var j = 0; j < incrementalBakeEnable[i].length; j++){
			if(incrementalBakeEnable[i][j] && app.project.activeSequence.sequenceID === linkSequenceParents[i].sequenceID){
				var oldClipList = incrementalBake_clips[i][j];
				var sourceIndex = incrementalBakeSource[i][j];
				var currentClips = linkSequenceParents[i].audioTracks[sourceIndex].clips;
				var removeList = [];
				var addList = [];

				var oldIdx = 0;
				for(var currentIdx = 0; currentIdx < currentClips.numItems; currentIdx++){
					var clip = currentClips[currentIdx];
					var itr = oldIdx;
					for(; itr < oldClipList.length; itr++){
						if(oldClipList[itr].nodeId === clip.nodeId){
							if(IsDifferent(oldClipList[itr], clip)){
								addList.push(clip);
								removeList.push(oldClipList[itr]);
							}
							for(; oldIdx < itr; oldIdx++){
								removeList.push(oldClipList[oldIdx]);
							}
							oldIdx = itr + 1;
							break;
						}
					}

					if(itr === oldClipList.length){
						addList.push(clip);
					}
				}
				for(; oldIdx < oldClipList.length; oldIdx++){
					removeList.push(oldClipList[oldIdx]);
				}

				if(removeList.length > 0){
					var animationSequence = linkAnimationSequence[i][j];
					var properties = linkAnimationProperties[i][j];
					var epsTime = animationSequence.getSettings().videoFrameRate.seconds;
					var sequenceList = getSequenceTrackItemsInSequence(linkSequenceParents[i], linkSequence[i].sequenceID);
					for(var k = 0; k < removeList.length; k++){
						var targetSequence = getClipAtTime(sequenceList, removeList[k].start);
						var start = getClipLocalTime(targetSequence, removeList[k].start);
						var end = getClipLocalTime(targetSequence, removeList[k].end);
						clearFrameAnimation(animationSequence, properties, start, end - epsTime, true);
					}
				}
				if(addList.length > 0){
					bakeAllDuration = false;
					$._PPP_.FrameAnimation_Audio(i, j, sourceIndex, addList)
				}

				if(addList.length !== 0 || removeList.length !== 0){
					var newClipList = [];
					for(var k = 0; k < currentClips.length; k++){
						newClipList.push(new ClipForIncrementalBake(currentClips[k]));
					}
					incrementalBake_clips[i][j] = newClipList;
				}
			}
		}
	}
}

function getTransition_Random(sequence, targetMarker){
	var epsTime = sequence.getSettings().videoFrameRate.seconds;
	var infoList = targetMarker.comments.split('\n');

	var transition = [];

	var indexes = infoList[2].split(',');
	var durations = infoList[3].split(',');
	transition.push(new FrameAnimationKey(Number(indexes[indexes.length - 1]), Number(durations[durations.length - 1]), epsTime));

	indexes = infoList[0].split(',');
	durations = infoList[1].split(',');
	for(var i = 0; i < indexes.length; i++) {
		transition.push(new FrameAnimationKey(Number(indexes[i]), Number(durations[i]), epsTime));
	}
	
	var transition_property = infoList[4].split(',');

	return [transition, transition_property];
}

function getTransition_Lip(sequence, targetMarker){
	var epsTime = sequence.getSettings().videoFrameRate.seconds;
	var infoList = targetMarker.comments.split('\n');

	var transition = [];

	var indexes = infoList[2].split(',');
	var durations = infoList[3].split(',');
	transition.push(new FrameAnimationKey(Number(indexes[indexes.length - 1]), Number(durations[durations.length - 1]), epsTime));

	indexes = infoList[0].split(',');
	durations = infoList[1].split(',');
	for(var i = 0; i < indexes.length; i++) {
		transition.push(new FrameAnimationKey(Number(indexes[i]), Number(durations[i]), epsTime));
	}

	return transition;
}

function getTransitionForClipset(sequence, targetMarker){
	var infoList = targetMarker.comments.split('\n');
	var indexes = infoList[0].split(',');
	var durations = infoList[1].split(',');
	var treePathList = [];

	treePathList.push(getTreePathFromActorClip(sequence.videoTracks[Number(infoList[2].split(',')[0])].clips[0]));
	for(var i = 0; i < indexes.length; i++){
		treePathList.push(getTreePathFromActorClip(sequence.videoTracks[Number(indexes[i])].clips[0]));
	}

	var frameList = [];
	frameList.push(Math.round(Number(infoList[3].split(',')[0]) * 60));
	for(var i = 0; i < durations.length; i++){
		frameList.push(Math.round(Number(durations[i]) * 60));
	}

	var result = '{"anim_clips":"' + treePathList.join(',') + '","frame":"' + frameList.join(',') + '"';;
	if(infoList.length >= 5){
		var randomInfo = infoList[4].split(',');
		result += ',"interval":"' + randomInfo[0].toString() + '","min":"' + randomInfo[1].toString() + '","max":"' + randomInfo[2].toString() + '"';
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

	var deactivateProperty = null;
	if(deactivateTrackIndex >= 0) {
		deactivateProperty = fAnimationProperties[deactivateTrackIndex];
	} else {
		for(var i = 0; i < fAnimationProperties.length; i++){
			if(fAnimationProperties[i] === null) continue;
			var prevKeyTime = fAnimationProperties[i].findPreviousKey(activateTime);
			if(prevKeyTime !== undefined){
				var lastValue = fAnimationProperties[i].getValueAtTime(prevKeyTime);
				if(lastValue == 100) {
					if(activateTrackIndex == i) return;
					deactivateProperty = fAnimationProperties[i];
					break;
				}
			}
		}

		if(deactivateProperty === null) {
			for(var i = 0; i < fAnimationProperties.length; i++){
				if(fAnimationProperties[i] === null) continue;
				var prevKeyTime = fAnimationProperties[i].getValueAtKey(activateTime);		
				if(prevKeyTime !== null){
					var lastValue = fAnimationProperties[i].getValueAtTime(prevKeyTime);
					if(lastValue == 100) {
						if(activateTrackIndex == i) return;
						deactivateProperty = fAnimationProperties[i];
						break;
					}
				}
			}
		}
	}

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
			fAnimationProperties[i].removeKeyRange(startTime, endTime);
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
				currentTransition = getTransition_Lip(animationSequence, currentMarker);
				nextMarker = getNextTransitionMarker(markers, currentMarker);
			}
			switchActiveTrack(fAnimationProperties, currentMarker.start.seconds , currentTransition[0].index, prevIndex, epsTime);
		} else {
			break;
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

function HasPassedMarkerChangeTime (time, nextMarker) {
	if(nextMarker !== null) {
		return nextMarker.start.seconds <= time;
	}
	return false;
}

function bakeFrameAnimation_Audio(allDuration){
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
			currentTransition = getTransition_Lip(fAnimationSequence, currentMarker);
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
		currentTransition = getTransition_Lip(fAnimationSequence, currentMarker);
		finalKey[Math.round(currentMarker.start.seconds / epsTime)] = currentTransition[0].index;
	}

	for(var clipIndex = 0; clipIndex < fAnimationSourceClipsLength; clipIndex++) {
		if(fAnimationSourceClips[clipIndex].mediaType === 'Audio') {
			var clipStart = fAnimationSourceClips[clipIndex].start.seconds;
			var targetSequence = getClipAtTime(sequenceList, clipStart);
			if(targetSequence === null) continue;
			clipStart = getClipLocalTime(targetSequence, clipStart);
			var clipEnd = getClipLocalTime(targetSequence, fAnimationSourceClips[clipIndex].end.seconds - epsTime * 2);
			var clipInPoint = fAnimationSourceClips[clipIndex].inPoint.seconds;
			var keypoints = fAnimationKeypoints[clipIndex].split(',');
			var startTime = fAnimationStartTime[clipIndex].split(',');

			if(!allDuration){
				clearFrameAnimation(fAnimationSequence, AnimationProperties, clipStart, clipEnd + epsTime, false);
				while(true){
					if(HasPassedMarkerChangeTime(clipStart, nextMarker)) {
						currentMarker = nextMarker;
						nextMarker = getNextTransitionMarker(markers, currentMarker);
					} else {
						break;
					}
				}
			}

			currentTransition = getTransition_Lip(fAnimationSequence, currentMarker);
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
				if(targetTime >= limitTime) break;

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
			finalKey[Math.round((clipEnd + epsTime) / epsTime)] = currentTransition[0].index;
		}
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
	for(var key in finalKey) {
		if(finalKey[key] !== prevIndex) {
			switchActiveTrack(AnimationProperties, Number(key) * epsTime, finalKey[key], prevIndex, epsTime);
			prevIndex = finalKey[key];
		}
	}

	if(allDuration){
		$._PPP_.SetIncrementalBakeFlag(fLinkedSequenceIndex, fAnimationSequenceIndex, fAnimationSourceIndex, 1);
		alert('complete');
	}
}

function bakeFrameAnimation_Random(end){
	var epsTime = fAnimationSequence.getSettings().videoFrameRate.seconds;
	var markers = fAnimationSequence.markers;

	if(markers.numMarkers == 0) return;
	var currentMarker = getFirstTransitionMarker(markers);
	var nextMarker = getNextTransitionMarker(markers, currentMarker);
	var currentTransition = null;
	var targetTime = 0;
	var prevIndex = -1;
	var period = Number(epsTime);
	var randomlyRange = 0;

	var _transition = getTransition_Random(fAnimationSequence, currentMarker);
	currentTransition = _transition[0];
	period = Number(_transition[1][0]);
	randomlyRange = Number(_transition[1][1]);

	var ChangeNextTransition = function(currentLevel){
		currentMarker = nextMarker;
		if(currentMarker !== null) {
			var prevLength = currentTransition.length;
			var _transition = getTransition_Random(fAnimationSequence, currentMarker);
			currentTransition = _transition[0];
			period = Number(_transition[1][0]);
			randomlyRange = Number(_transition[1][1]);
			nextMarker = getNextTransitionMarker(markers, currentMarker);
			currentLevel = Math.floor(currentLevel * currentTransition.length / prevLength);
			return currentLevel;
		}
		return 0;
	}

	switchActiveTrack(AnimationProperties, 0, currentTransition[0].index, prevIndex, epsTime);
	targetTime = Math.max(epsTime, period + (Math.random() * 2 - 1) * randomlyRange);

	while(targetTime < end) {
		while(true){
			if(HasPassedMarkerChangeTime(targetTime, nextMarker)) {
				ChangeNextTransition(0);
				switchActiveTrack(AnimationProperties, targetTime, currentTransition[0].index, prevIndex, epsTime);
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
		targetTime += Math.max(epsTime, period + (Math.random() * 2 - 1) * randomlyRange);
	}
	alert('complete');
}

function getFirstSequenceFromTrackItems(clips) {
	// todo animation sequence check
	var seq = null;
	for(var i = 0; i < clips.numItems; i++) {
		if(clips[i].projectItem.isSequence()) {
			seq = trackItemToSequence(clips[i]);
		}
	}
	return seq;
}

function getTrackItemAtTime(trackItems, time){
	for(var i = 0; i < trackItems.numItems; i++) {
		if(trackItems[i].inPoint.seconds <= time && time < trackItems[i].outPoint.seconds){
			return trackItems[i];
		}
	}
	return null;
}

function getTreePathFromActorClip(clip){
	var treePath = clip.projectItem.treePath;
	if(clip.projectItem.isSequence()) {
		treePath = '';
	}
	return treePath.slice(1 + treePath.indexOf('\\', 1 + treePath.indexOf('\\', 1 + treePath.indexOf('\\', 1)))).replace(/\\/g, '/');
}

function getParentBin(projectItem){
	var treePath = removeRootPath(projectItem.treePath);
	var index = treePath.lastIndexOf('/');
	if(index !== -1) {
		treePath = treePath.slice(0, index);
		return searchItemWithTreePath(treePath, ProjectItemType.BIN);
	} else {
		return app.project.rootItem.treePath.replace(/\\/g, '/');
	}
}

function removeRootPath(treePath) {
	treePath = treePath.replace(/\\/g, '/');
	var rootPath = app.project.rootItem.treePath.replace(/\\/g, '/');
	if(treePath.indexOf(rootPath) === 0){
		treePath = treePath.slice(rootPath.length + 1);
	}
	return treePath;
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

function overwriteVideoClip(projectItem, sequence, track, startTime, endFlag, endMarkerSequence){
	var clips = track.clips;
	var epsTime = sequence.getSettings().videoFrameRate.seconds;
	var endTime = startTime + 60 * 60;
	if(sequence.getOutPointAsTime().seconds > 0) {
		endTime = sequence.getOutPointAsTime().seconds;
	}

	endTime = getNextClipTime(clips, endFlag, startTime, endTime);
	if(endFlag & ACT_CLIPEND_MARKER) {
		endTime = getNextMarkerTime(endMarkerSequence.markers, startTime, endTime);
	}

	var _endTime = new Time();
	_endTime.seconds = fixTimeError(endTime, epsTime);
	projectItem.setOverrideFrameRate(1/epsTime);
	var _startTime = new Time();
	_startTime.seconds = fixTimeError(startTime, epsTime);
	projectItem.setInPoint(_startTime.ticks, 4);
	projectItem.setOutPoint(_endTime.ticks, 4);
	track.overwriteClip(projectItem, startTime);
	projectItem.setOverrideFrameRate(0);
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

function getSequenceTrackItemsInSequence(parentSequence, targetSequenceID){
	var sequenceList = [];
	for(var i = 0; i < parentSequence.videoTracks.numTracks; i++){
		var clips = parentSequence.videoTracks[i].clips;
		for(var j = 0; j < clips.numItems; j++){
			if(clips[j].projectItem.isSequence()){
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

function getClipAtTime(trackItemList, time){
	for(var i = 0; i < trackItemList.length; i++){
		if(trackItemList[i].start.seconds <= time && time < trackItemList[i].end.seconds){
			return trackItemList[i];
		}
	}
	return null;
}
