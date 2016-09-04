var fs = require('fs');
var pp = require('jsfx-preprocessor');

var source = fs.readFileSync(__dirname + '/pad-synth.txt', {encoding: 'utf-8'});
var targetFile = process.argv[2] || 'pad-synth';
fs.writeFileSync(targetFile, pp(source));

if (process.argv[3]) {
	var source = fs.readFileSync(__dirname + '/ui-lib.jsfx-inc', {encoding: 'utf-8'});
	var targetFile = process.argv[3];
	fs.writeFileSync(targetFile, pp(source));
}
