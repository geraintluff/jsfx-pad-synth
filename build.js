var fs = require('fs');
var pp = require('jsfx-preprocessor');

var source = fs.readFileSync(__dirname + '/pad-synth.txt', {encoding: 'utf-8'});
var targetFile = process.argv[2] || 'pad-synth.jsfx';
fs.writeFileSync(targetFile, pp(source));