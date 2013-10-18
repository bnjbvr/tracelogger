load("engine.js")
var textmap = JSON.parse(read(data["dict"]))
var array = read(data["tree"], 'binary');
var tree = new DataTree(array.buffer, textmap);
var threshold = (tree.stop(0) - tree.start(0))/640000 // accurency of 0.1px when graph shown on 1600 width display (1600*400)

var fullOverview = new Overview(tree, {});
fullOverview.init();

var partOverview = new Overview(tree, {
  maxThreshold:threshold
});
partOverview.init();

// Create a correction based on the reduced/decreased information
var correction = {
  engineOverview: {},
  scriptTimes: {},
  scriptOverview: {}
}
for(i in fullOverview.engineOverview)
  correction.engineOverview[i] = fullOverview.engineOverview[i] - partOverview.engineOverview[i];
for(i in fullOverview.scriptTimes) {
  correction.scriptTimes[i] = {
    "c": fullOverview.scriptTimes[i]["c"] - partOverview.scriptTimes[i]["c"],
    "s": fullOverview.scriptTimes[i]["s"] - partOverview.scriptTimes[i]["s"]
  }
}
for(script in fullOverview.scriptOverview) { 
  correction.scriptOverview[script] = {}
  for (part in fullOverview.scriptOverview[script]) {
    correction.scriptOverview[script][part] = fullOverview.scriptOverview[script][part] 
    if (typeof partOverview.scriptOverview[script] != "undefined" &&
        typeof partOverview.scriptOverview[script][part] != "undefined") {
      correction.scriptOverview[script][part] -= partOverview.scriptOverview[script][part];
    }
  }
}

print(JSON.stringify(correction));
