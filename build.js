var fs = require('fs');
var pp = require('jsfx-preprocessor');

var source = fs.readFileSync(__dirname + '/pad-synth.txt', {encoding: 'utf-8'});
var result = pp(source);

['pad-synth.jsfx'].concat(process.argv.slice(2)).forEach(function(targetFile) {
	fs.writeFileSync(targetFile, result);
	console.log('wrote: ' + targetFile);
});