var fs = require('fs');
var JsfxUi = require('./jsfx-ui');

var source = fs.readFileSync(__dirname + '/pad-synth.txt');

var ui = new JsfxUi();
var mainScreen = ui.screen('main');
//mainScreen.top('gfx_texth', {line: true}).text('PadSynth');
//mainScreen.top('gfx_texth', {line: false, textRgb: [0.5, 0.5, 0.5]}).text('by Geraint Luff');
var top = mainScreen.top('gfx_texth*2.5');
top.split(0.5, {line: true}).text('PadSynth');
top.text('by Geraint Luff', {text: [0.5, 0.5, 0.5]});

var waveform = mainScreen.inset(10).background([0, 0, 0]);
waveform.code([
	'ui_wavetable = wavetables_start;',
	'ui_wavetable_samples = ui_wavetable + wavetable_headerlength;',
	'gi = 0;',
	'gfx_r = gfx_b = gfx_g = 1;',
	'gfx_x = box_left;',
	'gfx_y = box_top + box_height/2;',
	'while (',
	'\tui_value = ui_wavetable_samples[gi];',
	'\tui_x = box_left + gi/wavetable_sampleslength*box_width;',
	'\tui_y = box_top + 0.5*(1 - ui_value)*box_height;',
	'\tgfx_lineto(ui_x, ui_y);',
	'\tgi += 1;',
	'\tgi < wavetable_sampleslength;',
	');'
], 'box_');

var code = ui.toString();

var targetFile = process.argv[2];
if (targetFile) {
	fs.writeFileSync(targetFile, source + '\n@gfx\n' + code);
	console.log(code);
} else {
	process.stdout.write(code);
}
