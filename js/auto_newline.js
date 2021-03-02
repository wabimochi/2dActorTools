const kuromoji = require('kuromoji');

function autoNewLine_ExecuteButton() {
    let maxCharactorNum = 10;
    let insertMarkerColor = -1;
    let warningMarkerColor = -1;
    let maxLineNum = 10000;
    if($('#auto_newline_marker').prop('checked')) {
        let marker_index = $('#auto_newline_normal_marker_color div:nth-child(2)');
        for(insertMarkerColor = 0; insertMarkerColor < 8; insertMarkerColor++) {
            if(marker_index.hasClass('merker_color_selected')) {
                break;
            }
            marker_index = marker_index.next();
        }

        marker_index = $('#auto_newline_warning_marker_color div:nth-child(2)');
        for(warningMarkerColor = 0; warningMarkerColor < 8; warningMarkerColor++) {
            if(marker_index.hasClass('merker_color_selected')) {
                break;
            }
            marker_index = marker_index.next();
        }

        if(insertMarkerColor >= 8) insertMarkerColor = 0;
        if(warningMarkerColor >= 8) warningMarkerColor = 1;
        maxLineNum = Number($('#auto_newline_maxlinecount').val());
        if(maxLineNum < 1) maxLineNum = 1;
    }
    maxCharactorNum = Number($('#auto_newline_maxcount').val());
    if(maxCharactorNum < 1) maxCharactorNum = 1;

    const asciiIsHalf = $('#auto_newline_ascii').prop('checked');
    const initNewLine = $('#auto_newline_flatten').prop('checked');
    const autoNewLine = $('#auto_newline_insert').prop('checked');
    auto_new_line(maxCharactorNum, maxLineNum, insertMarkerColor, warningMarkerColor, asciiIsHalf, initNewLine, autoNewLine);
}

function autoNewLineMarkerUIUpdate() {
    const checkbox = $('#auto_newline_marker');
    const parent = checkbox.closest('div')
    if(checkbox.prop('checked')) {
        let nextElm = parent.next();
        nextElm.removeClass('events_disable');
        nextElm = nextElm.next();
        nextElm.removeClass('events_disable');
        nextElm = nextElm.next();
        nextElm.removeClass('events_disable');
    } else {
        let nextElm = parent.next();
        nextElm.addClass('events_disable');
        nextElm = nextElm.next();
        nextElm.addClass('events_disable');
        nextElm = nextElm.next();
        nextElm.addClass('events_disable');
    }
}

function auto_new_line(maxCharactorNum, maxLineNum, insertMarkerColor, warningMarkerColor, asciiIsHalf, initNewLine, autoNewLine) {
    var csInterface = new CSInterface();
    csInterface.evalScript('$._PPP_.AutoNewLine_GetSourceText()', function(result){
        let textList = result.split('/');
        var extPath = csInterface.getSystemPath(SystemPath.EXTENSION);
        var builder = kuromoji.builder({dicPath: extPath + '/node_modules/kuromoji/dict'});
        builder.build(function(err, tokenizer) {
            if(err){throw err}
            let processedText = [];
            let processedFlag = [];
            const textListLength = textList.length;
            if(initNewLine) {
                for(let i = 0; i < textListLength; i++) {
                    textList[i] = textList[i].replace(newLineReg, '');
                }
            }
            for(let i = 0; i < textListLength; i++) {
                let oneLineTextList = textList[i].split(newLineReg);
                let preProcessedText = [];
                let process = -1;
                for(let j = 0; j < oneLineTextList.length; j++) {
                    let charactorCount = oneLineTextList[j].length;
                    if(asciiIsHalf) {
                        const arr = oneLineTextList[j].match(asciiReg);
                        if(arr) {
                            charactorCount = Math.ceil(charactorCount - arr.length * 0.5);
                        }
                    }
                    if(charactorCount > maxCharactorNum) {
                        if(autoNewLine) {
                            let tokens = tokenizer.tokenize(oneLineTextList[j]);
                            let [newLineText , split_fail] = tokenInsertNewLine(tokens, maxCharactorNum, asciiIsHalf);
                            Array.prototype.push.apply(preProcessedText, newLineText);
                            if(split_fail) {
                                process = 2;
                            }
                        } else {
                            preProcessedText.push(oneLineTextList[j]);
                        }
                        if(process !== 2) {
                            process = 1;
                        }
                    } else {
                        preProcessedText.push(oneLineTextList[j]);
                    }
                }

                if (preProcessedText.length > maxLineNum) {
                    process = 2;
                }
                processedText.push(preProcessedText.join('\n'));
                if(process === 1) {
                    processedFlag.push(insertMarkerColor);
                } else if(process === 2) {
                    processedFlag.push(warningMarkerColor);
                } else {
                    processedFlag.push(-1);
                }
            }
            csInterface.evalScript('$._PPP_.AutoNewLine_Replace("'+ processedText.join('/').replace(newLineReg, '\\n').replace(/\"/g, '\\"') +'","' + processedFlag.join('/') + '")', function(result) {
            });				
        });
    });
}

function countSelectedClipTextLength() {
    var csInterface = new CSInterface();
    csInterface.evalScript('$._PPP_.GetSelectedClipText()', function(result){
        if(result) {
            let charactorCount = result.length;
            if($('#auto_newline_ascii').prop('checked')) {
                const arr = result.match(asciiReg);
                if(arr) {
                    charactorCount = Math.floor(charactorCount - arr.length * 0.5);
                }
            }
            $('#auto_newline_maxcount').val(charactorCount);
            $('#auto_newline_maxcount').change();
        }
    });
}

function tokenInsertNewLine(tokens, maxCharactorNum, asciiIsHalf) {
    let processedText = [];
    let tokensLength = tokens.length;
    let wordList = [];
    let prevWordPos = 0;
    let prevIndex = -1;
    let offset = 0;
    let split_fail = 0;
    
    for(let i = 0; i < tokensLength; i++) {
        if(asciiIsHalf) {
            const arr = tokens[i].surface_form.match(asciiReg);
            if(arr) {
                offset = offset + arr.length * 0.5;
            }
        }
        const wordLength = tokens[i].word_position + tokens[i].surface_form.length;
        if(Math.ceil(wordLength - prevWordPos - offset) > maxCharactorNum) {
            let j = i - 1;
            let secondChoice = -1;
            let thirdChoice = -1;
            let fourthChoice = -1;
            for(; j > prevIndex; j--) {
                if(tokens[j + 1].pos_detail_1 !== '読点' && tokens[j + 1].pos_detail_1 !== '句点') {
                    if((tokens[j].pos === '助詞' && tokens[j + 1].pos !== '動詞') || 
                        tokens[j].pos_detail_1 === '読点' || 
                        tokens[j].pos_detail_1 === '句点' || 
                        tokens[j].pos_detail_1 === '空白') {
                        processedText.push(wordList.join(''));
                        prevWordPos = tokens[j].word_position;
                        i = j;
                        prevIndex = j;
                        break;
                    } else if(secondChoice === -1 && tokens[j].pos === '助動詞') {
                        secondChoice = j;
                    } else if(thirdChoice === -1 && tokens[j].pos === '形容詞') {
                        thirdChoice = j;
                    } else if(fourthChoice === -1 && tokens[j].pos === '助詞') {
                        fourthChoice = j;
                    }
                }
                wordList.pop();
            }
            if(wordList.length === 0) {
                let choiceIndex = i - 1;
                if(secondChoice !== -1) {
                    choiceIndex = secondChoice;
                } else if(thirdChoice !== -1) {
                    choiceIndex = thirdChoice;
                } else if(fourthChoice !== -1) {
                    choiceIndex = fourthChoice;
                }
                if(prevIndex !== choiceIndex) {
                    for(let k = prevIndex + 1; k <= choiceIndex; k++) {
                        wordList.push(tokens[k].surface_form);
                    }
                } else {
                    split_fail = -1;
                    choiceIndex = prevIndex + 1;
                    wordList.push(tokens[choiceIndex].surface_form);
                }
                processedText.push(wordList.join(''));
                prevWordPos = tokens[choiceIndex].word_position;
                i = choiceIndex;
                prevIndex = choiceIndex;
            }
            wordList = [];
            offset = 0;
        } else {
            wordList.push(tokens[i].surface_form);
        }
    }
    if(wordList.length > 0) {
        processedText.push(wordList.join(''));
    }
    return [processedText, split_fail];
}

// AutoNewLineInitialize
CustomInitialize['auto_newline_custum_initialize'] = function () {
    const category = ExtensionSettings['autonewline'];
    const normal_marker_parent = $('#auto_newline_normal_marker_color');
    const warning_marker_parent = $('#auto_newline_warning_marker_color');
    if(category) {
        let marker_color = category['auto_newline_normal_marker_color'];
        if(marker_color) {
            normal_marker_parent.children().eq(Number(marker_color)).click();
        } else {
            normal_marker_parent.children().eq(1).click();
        }
        marker_color = category['auto_newline_warning_marker_color'];
        if(marker_color) {
            warning_marker_parent.children().eq(Number(marker_color)).click();
        } else {
            warning_marker_parent.children().eq(2).click();
        }
    } else {
        normal_marker_parent.children().eq(1).click();
        warning_marker_parent.children().eq(2).click();
    }
    autoNewLineMarkerUIUpdate();
}