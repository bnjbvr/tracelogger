var loaded = {
  dict: false,
  tree: false
}

var tree = undefined;
var page = undefined;
var textmap = undefined;
var buffer = undefined;
var corrections = undefined;

var xhr = new XMLHttpRequest();
xhr.open('GET', data["dict"], true);
xhr.onload = function(e) {
  textmap = JSON.parse(this.response);
  loaded.dict = true;
  finished();
};
xhr.send();

var xhr2 = new XMLHttpRequest();
xhr2.open('GET', data["tree"], true);
xhr2.responseType = 'arraybuffer';
xhr2.onload = function(e) {
  buffer = this.response;
  loaded.tree = true;
  finished();
};
xhr2.send();

if (typeof data.corrections != "undefined") {
  loaded.corrections= false;

  var xhr3 = new XMLHttpRequest();
  xhr3.open('GET', data["corrections"], true);
  xhr3.onload = function(e) {
    console.log(this.response)
    corrections = JSON.parse(this.response);
    loaded.corrections = true;
    finished();
  };
  xhr3.send();
}

function finished() {
  for (i in loaded)
    if (!loaded[i])
      return;

  tree = new DataTree(buffer, textmap);
  page = new Page();
  page.init()
}

function percent(double) {
  return Math.round(double*10000)/100;
}

function DrawCanvas(dom, tree) {
  this.dom = dom;
  this.ctx = dom.getContext("2d");
  this.tree = tree;
  this.line_height = 10;
  this.duration = this.tree.stop(0);

  this.drawQueue = []
  this.drawThreshold = 1
}

DrawCanvas.prototype.drawItem = function(id) {
  var start = this.tree.start(id);
  var stop = this.tree.stop(id);
  var color = this.color(this.tree.text(id));

  if (!this.drawRect(start, stop, color)) {
    this.futureDrawQueue[this.futureDrawQueue.length] = id
    return;
  }

  var childs = this.tree.childs(id);
  for (var i = 0; i < childs.length; i++) {
    this.drawItem(childs[i]);
  }
}

DrawCanvas.prototype.drawRect = function(start, stop, color) {
  var x_start = start * this.conversion;
  var y_start = Math.floor(x_start / this.width) * this.line_height;
  x_start = x_start % this.width;

  var x_stop = stop * this.conversion;
  var y_stop = Math.floor(x_stop / this.width) * this.line_height;
  x_stop = x_stop % this.width;


  this.ctx.fillStyle = color;
  if (y_start == y_stop) {
    if (x_stop - x_start < this.drawThreshold)
      return false;

    this.ctx.fillRect(x_start, y_start, x_stop - x_start, this.line_height);
    return true;
  }

  this.ctx.fillRect(x_start, y_start, this.width - x_start, this.line_height);
  for (var i = y_start + this.line_height; i < y_stop; i += this.line_height) {
    this.ctx.fillRect(0, i, this.width, this.line_height);
  }
  this.ctx.fillRect(0, y_stop, x_stop, this.line_height);
  return true;
}

DrawCanvas.prototype.color = function (info) {
  var letter = info.substr(0,1);
  if (letter == "s") {
    return "#FFFFFF";
  }

  if (letter == "c")
    return "green";

  if (letter == "r")
    return "#BE8CFF";

  if (letter == "g")
    return "#CCCCCC";

  if (letter == "G")
    return "#666666";

  if (letter == "i")
    return "#FFFFFF";
  if (letter == "b")
    return "#FFE75E";
  if (letter == "o")
    return "#54D93D";

  if (letter == "p") {
    var type = info.substr(1,1);
    if (type == "s")
      return "#DB0000";
    if (type == "l")
      return "#A30000";
    if (type == "f")
      return "#CC8585";
  }

  return "white";
}

DrawCanvas.prototype.backtraceAtPos = function (x, y) {
  var tick = Math.floor(y / this.line_height) * this.width + x;
  tick = tick / this.conversion;

  var id = 0;
  var bt = []
  var found = true;

  while (found) {
    found = false;

    var childs = this.tree.childs(id);
    for (var i = 0; i < childs.length; i++) {
      if (this.tree.start(childs[i]) <= tick && this.tree.stop(childs[i]) > tick) {
        id = childs[i]
        bt[bt.length] = this.tree.text(id);
        found = true
        break;
      }
    }
  }

  return bt;
}

DrawCanvas.prototype.draw = function() {
  this.width = this.dom.width;
  this.height = Math.floor(this.dom.height / this.line_height) * this.line_height;
  this.length_ = this.width * this.height / this.line_height;
  this.conversion = this.length_ / this.duration;

  this.drawThreshold = 5
  this.drawQueue = this.tree.childs(0);
  this.futureDrawQueue = []

  clearTimeout(this.timer);
  this.timer = setTimeout(DrawCanvas.prototype.drawQueue.bind(this), 1);
}

DrawCanvas.prototype.drawQueue = function() {
  var queue = this.drawQueue.splice(0,10000);
  for (var i=0; i<queue.length; i++) {
    this.drawItem(queue[i])
  }

  if (this.drawQueue.length > 0) {
    this.timer = setTimeout(DrawCanvas.prototype.drawQueue.bind(this), 1);
    return;
  }

  if (this.futureDrawQueue.length > 0) {
    this.drawQueue = this.futureDrawQueue;
    this.futureDrawQueue = []
    if (this.drawThreshold < 0.05)
      return;
    this.drawThreshold = this.drawThreshold / 2
    this.timer = setTimeout(DrawCanvas.prototype.drawQueue.bind(this), 1);
    return;
  }
}

function translate(info) {
  info = info.split(",")
  info[0] = translateSubject(info[0]);
  return info.join(", ")
}

function translateSubject(subject) {
  switch(subject) {
    case "i": return "interpreter";
    case "b": return "baseline";
    case "o": return "ionmonkey";
    case "pl": return "lazy parsing";
    case "ps": return "script parsing";
    case "pF": return "'Function' parsing";
    case "s": return "script";
    case "G": return "GC";
    case "g": return "Minor GC";
    case "gS": return "GC sweeping";
    case "gA": return "GC allocating";
    case "r": return "regexp";
    case "c": return "IM compilation";
  }
}

function translateScript(script) {
  var arr = script.split("/");
  return "<span title='"+script+"'>"+arr[arr.length-1]+"</span>";
}

function Page() {}
Page.prototype.init = function() {
  this.initGraph()
  this.initOverview()
}

Page.prototype.initGraph = function() {
  this.canvas = new DrawCanvas(document.getElementById("myCanvas"), tree);
  this.resize();
  window.onresize = this.resize.bind(this);
  this.canvas.dom.onclick = this.clickCanvas.bind(this);
}

Page.prototype.resize = function() {
  this.canvas.dom.width = (document.body.clientWidth - 350)
  this.canvas.draw();
}

Page.prototype.initOverview = function() {
  this.overview = new Overview(tree, {
    chunk_cb: Page.prototype.computeOverview.bind(this)
  });

  if (typeof data.corrections != "undefined") {
    this.overview.engineOverview = corrections.engineOverview;
    this.overview.scriptOverview = corrections.scriptOverview;
    this.overview.scriptTimes = corrections.scriptTimes;
  }

  this.overview.init();
}

Page.prototype.computeOverview = function () {
  var dom = document.getElementById("engineOverview");
  var output = "<h2>Engine Overview</h2>"+
               "<table><tr><td>Engine</td><td>Percent</td>";

  var total = 0;
  for (var i in this.overview.engineOverview) {
    total += this.overview.engineOverview[i];
  }

  for (var i in this.overview.engineOverview) {
    output += "<tr><td>"+translateSubject(i)+"</td><td>"+percent(this.overview.engineOverview[i]/total)+"%</td></tr>";
  }
  output += "</table>";
  dom.innerHTML = output;

  dom = document.getElementById("scriptOverview");
  var output = "<h2>Script Overview</h2>"+
               "<table><tr><td>Script</td><td>Times called</td><td>Times compiled</td><td>Total time</td><td>Spend time</td></tr>";
  for (var script in this.overview.scriptOverview) {
    output += "<tr><td>"+translateScript(script)+"</td><td>"+this.overview.scriptTimes[script]["s"]+"</td><td>"+this.overview.scriptTimes[script]["c"]+"</td><td>";
    var script_total = 0;
    for (var j in this.overview.scriptOverview[script]) {
      script_total += this.overview.scriptOverview[script][j];
    }
    output += percent(script_total/total)+"%</td><td>";
    for (var j in this.overview.scriptOverview[script]) {
      output += ""+translateSubject(j)+": "+percent(this.overview.scriptOverview[script][j]/script_total)+"%, ";
    }
    output += "</td></tr>"
  }
  output += "</table>"
  dom.innerHTML = output;
}

Page.prototype.clickCanvas = function(e) {
    var posx = 0;
    var posy = 0;
    if (!e) var e = window.event;
    if (e.offsetX || e.offsetY) {
        posx = e.offsetX;
        posy = e.offsetY;
    }
    else if (e.layerX || e.layerY) {
        posx = e.layerX;
        posy = e.layerY;
    }

    var backtrace = this.canvas.backtraceAtPos(posx, posy);
    var output = "";
    for (var i=0; i < backtrace.length; i++) {
      var info = backtrace[i].split(",")
      if (info[0] == "s" || info[0] == "c" || info[0] == "pl" || info[0] == "ps" || info[0] == "pF") {
        var out = translate(backtrace[i]).split(", ")
        out[1] = translateScript(out[1]);
        output += out.join(", ")+"<br />";

        if (backtrace[i].substring(0,1) == "s")
          i++;
      } else {
        output += translate(backtrace[i])+"<br />";
      }
    }
    document.getElementById("backtrace").innerHTML = output;
}
