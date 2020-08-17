const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const path = require("path");
const HTMLParser = require('node-html-parser');
var directory = "";
var duration = 0; // in ms
var totalTests = 0;
var suitesCompleted = 0;
var suitesAborted = 0;
var testsSucceeded = 0;
var testsFailed = 0;
var testsCanceled = 0;
var testsIgnored = 0;
var testsPending = 0;
var tableRows = [];
var tagMap = {};
var rawFileContent = "";
var copiedCss = false;
var copiedImages = false;
var copiedJs = false;

try {
	console.log("Called scalatest multiproject html merge action.")
	directory = core.getInput("path");
	console.log("With directory: " + directory)
	main(directory);
	console.log("Finished action.")
} catch (error) {
  	core.setFailed(error);
}

function walkSync(currentDirPath, callback) {
    fs.readdirSync(currentDirPath).forEach(function (name) {
        var filePath = path.join(currentDirPath, name);
        var stat = fs.statSync(filePath);
        if (stat.isFile()) {
            callback(filePath, stat);
        } else if (stat.isDirectory()) {
			walkSync(filePath, callback);
			if (!copiedCss && filePath.endsWith("css")) {
				copyRecursiveSync(filePath, directory + path.sep + "css");
				copiedCss = true;
			}
			if (!copiedImages && filePath.endsWith("images")) {
				copyRecursiveSync(filePath, directory + path.sep + "images");
				copiedImages = true;
			}
			if (!copiedJs && filePath.endsWith("js")) {
				copyRecursiveSync(filePath, directory + path.sep + "js");
				copiedJs = true;
			}
        }
    });
}

function copyRecursiveSync(src, dest) {
	var exists = fs.existsSync(src);
	var stats = exists && fs.statSync(src);
	var isDirectory = exists && stats.isDirectory();
	if (isDirectory) {
	  fs.mkdirSync(dest);
	  fs.readdirSync(src).forEach(function(childItemName) {
		copyRecursiveSync(path.join(src, childItemName),
						  path.join(dest, childItemName));
	  });
	} else {
	  fs.copyFileSync(src, dest);
	}
  };


function main(directory) {
    walkSync(directory, function(filePath, stat) {
        if(filePath.endsWith("index.html")) {
            if (rawFileContent == "") {
                rawFileContent = fs.readFileSync(filePath, 'utf8');
            }
            extractSummary(filePath);
            extractTableRows(filePath);
            extractTagMap(filePath);
        }
	});
	console.log("Extracted all information from test reports")
    assembleFile();
	console.log("Assembled file contents")
	fs.writeFileSync(directory + "index.html", rawFileContent);
	console.log("Wrote index.html")
}

function assembleFile() {
    const root = HTMLParser.parse(rawFileContent, {style: true, pre: true, comment: true, script: true});


    // replace summaries
    root.querySelector("#duration").set_content(buildDurationString());
    root.querySelector("#totalTests").set_content("Total number of tests run: " + totalTests);
    root.querySelector("#suiteSummary").set_content("Suites: completed " + suitesCompleted + ", aborted " + suitesAborted)
    root.querySelector("#testSummary").set_content("Tests: succeeded "+ testsSucceeded + ", failed " + testsFailed + ", canceled " + testsCanceled + ", ignored " + testsIgnored + ", pending " + testsPending)
    root.querySelector("#summary_view_row_1_legend_succeeded_count").set_content(testsSucceeded.toString());
    root.querySelector("#summary_view_row_1_legend_succeeded_percent").set_content(`(${((testsSucceeded / totalTests)*100).toFixed(2)}%)`);
    root.querySelector("#summary_view_row_1_legend_failed_count").set_content(testsFailed.toString());
    root.querySelector("#summary_view_row_1_legend_failed_percent").set_content(`(${((testsFailed / totalTests)*100).toFixed(2)}%)`);
    root.querySelector("#summary_view_row_1_legend_canceled_count").set_content(testsCanceled.toString());
    root.querySelector("#summary_view_row_1_legend_canceled_percent").set_content(`(${((testsCanceled / totalTests)*100).toFixed(2)}%)`);
    root.querySelector("#summary_view_row_1_legend_ignored_count").set_content(testsIgnored.toString());
    root.querySelector("#summary_view_row_1_legend_ignored_percent").set_content(`(${((testsIgnored / totalTests)*100).toFixed(2)}%)`);
    root.querySelector("#summary_view_row_1_legend_pending_count").set_content(testsPending.toString());
    root.querySelector("#summary_view_row_1_legend_pending_percent").set_content(`(${((testsPending / totalTests)*100).toFixed(2)}%)`);

    // replace rows
    root.querySelector(".sortable").set_content(tableRows);


    rawFileContent = root.toString();

    // replace script data for pie
    const dataIndex = rawFileContent.indexOf("var data = ");
    const openingBracket = rawFileContent.indexOf("[", dataIndex)
    const closingBracket = rawFileContent.indexOf("]", openingBracket);
    const instantiation = rawFileContent.substring(openingBracket, closingBracket + 1);

    rawFileContent = replaceTagListForFiltering(rawFileContent);

    rawFileContent = rawFileContent.replace(instantiation, `[${testsSucceeded}, ${testsFailed}, ${testsCanceled}, ${testsIgnored}, ${testsPending}]`);
}

function replaceTagListForFiltering(contents) {
    const tagMapIndex = contents.lastIndexOf("tagMap = ");
    const opening = contents.indexOf("{", tagMapIndex);
    const closing = contents.indexOf("}", opening);

    const stringMap = contents.substring(opening, closing+1);

    const s = new String(contents);

    return s.replace(stringMap, JSON.stringify(tagMap));
}

function buildDurationString() {
    let h = 0;
    let m = 0;
    let s = 0;
    let ms = 0;

    let remainder = duration;

    while (remainder > 0) {
        if (remainder > 60*60*1000) {
            h += 1;
            remainder -= 60*60*1000;
        } else if (remainder > 60*1000) {
            m += 1;
            remainder -= 60*1000;
        } else if (remainder > 1000) {
            s += 1;
            remainder -= 1000;
        } else {
            ms += remainder;
            remainder = 0;
        }
    }

    let args = new Array();
    if (h > 0) {
        args.push(h+ " hours")
        args.push(m + " minutes")
        args.push(s + " seconds")
        args.push(ms + " milliseconds")
    }
    else if (m > 0) {
        args.push(m + " minutes")
        args.push(s + " seconds")
        args.push(ms + " milliseconds")
    }
    else if (s > 0) {
        args.push(s + " seconds")
        args.push(ms + " milliseconds")
    }
    else if (ms > 0) {
        args.push(ms + " milliseconds")
    }
    const reducedArgs = args.reduce((a,b) => { return a + ", " + b});
    return "Run completed in " + reducedArgs + "."
}

function extractTagMap(file) {
    const contents = fs.readFileSync(file, 'utf8')
    const tagMapIndex = contents.lastIndexOf("tagMap = ");
    const opening = contents.indexOf("{", tagMapIndex);
    const closing = contents.indexOf("}", opening);

    const stringMap = contents.substring(opening, closing+1);

    const map = JSON.parse(stringMap);
    tagMap = {...tagMap, ...map};
}

function extractTableRows(file) {
    const contents = fs.readFileSync(file, 'utf8')
    const root = HTMLParser.parse(contents)    
    const table = root.querySelector(".sortable");

	const splitFile = file.split(path.sep);
    const dir = splitFile[splitFile.length -2];
    // add table legend
    if (tableRows.length == 0) {
        tableRows.push(table.childNodes[1]);
    }

    const interestingRows = table.childNodes.filter(node => node.id != undefined)
    interestingRows.forEach(node => {
        node.querySelectorAll("a").forEach(link => {
            let linkText = link.getAttribute("href");
            linkText = linkText.replace("showDetails(\'", "showDetails(\'" + dir + path.sep);
            link.setAttribute("href", linkText);
        });
    })

    tableRows.push(...interestingRows);
}


function extractSummary(file) {
    const contents = fs.readFileSync(file, 'utf8')
    const root = HTMLParser.parse(contents)

    const dur = root.querySelector("#duration");
    duration += getDurationInMilliseconds(dur.rawText);   

    const tt = root.querySelector("#totalTests");
    totalTests += getTotalTests(tt.rawText);

    const ss = root.querySelector("#suiteSummary");
    let suiteRes = getSuiteSummary(ss.rawText);
    suitesCompleted += suiteRes.suitesCompleted;
    suitesAborted += suiteRes.suitesAborted;

    const ts = root.querySelector("#summary_view");
    let testRes = getTestSummary(ts);
    testsSucceeded += testRes.testsSucceeded;
    testsFailed += testRes.testsFailed;
    testsCanceled += testRes.testsCanceled;
    testsIgnored += testRes.testsIgnored;
    testsPending += testRes.testsPending;
}

function getTestSummary(ts) {
    return {
        testsSucceeded: parseInt(ts.querySelector("#summary_view_row_1_legend_succeeded_count").rawText),
        testsFailed: parseInt(ts.querySelector("#summary_view_row_1_legend_failed_count").rawText),
        testsCanceled: parseInt(ts.querySelector("#summary_view_row_1_legend_canceled_count").rawText),
        testsIgnored: parseInt(ts.querySelector("#summary_view_row_1_legend_ignored_count").rawText),
        testsPending: parseInt(ts.querySelector("#summary_view_row_1_legend_pending_count").rawText),
    }
}

function getSuiteSummary(summary) {
    // format: Suites: completed 2, aborted 0
    
    var s = new String(summary);
    s = s.replace(/,/g, "");
    s = s.replace(/\./g, "");

    const split = s.split(" ");
    var completed = 0;
    var aborted = 0; 

    for (var i = 0; i < split.length; i++) {
        switch (split[i]) {
            case "completed":
                completed += parseInt(split[i+1]);
                break;
            case "aborted": 
                aborted += parseInt(split[i+1]);
                break;
            default:
                break;
        }
    }
    return {suitesCompleted: completed, suitesAborted: aborted};
}

function getTotalTests(totalTestsString) {
    // format: Total number of tests run: 12
    const s = new String(totalTestsString);
    const split = s.split(" ");
    return parseInt(split[split.length -1]);
}

function getDurationInMilliseconds(durationString) {
    // format: "Run completed in x hours, y minutes, z seconds, u milliseconds."
    var hours = 0;
    var minutes = 0;
    var seconds = 0;
    var milliseconds = 0;

    var string = new String(durationString);
    string = string.replace(/,/g, "");
    string = string.replace(/\./g, "");
    var split = string.split(" ");


    for (var i = 0; i < split.length; i++) {
        switch (split[i]) {
            case "hours":
                hours += parseInt(split[i-1]);
                break;
            case "minutes": 
                minutes += parseInt(split[i-1]);
                break;
            case "seconds":
                seconds += parseInt(split[i-1]);
                break;
            case "milliseconds":
                milliseconds += parseInt(split[i-1]);
                break;
            default:
                break;
        }
    }

    var elapsedTime = milliseconds + 1000*(seconds + 60*(minutes + 60 * hours));
    return elapsedTime;
}
