var fs = require('fs');
var JsfxUi = require('./jsfx-ui');

var source = fs.readFileSync(__dirname + '/pad-synth.txt');

var ui = new JsfxUi();
var main = ui.screen('main');

// Main
var top = main.top('25', {line: true}).color(null, [1, 1, 1]);
top.text('PadSynth').text('by Geraint Luff', {text: [0.5, 0.5, 0.5], align: 1});
var body = main.inset(20, 10);
var buttonBar = body.top(25).inset(0, 0, 0, 5);
buttonBar.splitX(0.5).button('can_recompute', 'action_recompute = 1', 'action_recompute = 1;').text('Recompute');

var aboutPage = buttonBar.subView('About');
aboutPage.splitY(0.3).text('About');
aboutPage.wrapText('This is an implementation of the "padsynth" algorithm from ZynAddSubFX.  The samples are designed in the frequency domain (which allows customised harmonic spread) and then generated using an inverse FFT.\n\nThe GUI for this synth is generated in JavaScript.');
aboutPage.text('Remainder');

var waveform = body;
waveform.code([
	'ui_wavetable = wavetables_start + display_wavetable_index*wavetable_step;',
	'ui_wavetable_samples = ui_wavetable + wavetable_headerlength;',
	'gis = ceil(ui_wavetable_samples*0.25/box_width);',
	'gi = 0;',
	'gfx_r = 0.25;',
	'gfx_g = 0.5;',
	'gfx_b = 0.75;',
	'gfx_x = box_left;',
	'gfx_y = box_top + box_height/2;',
	'while (',
	'\tui_value = min(1, max(-1, ui_wavetable_samples[gi*2]));',
	'\tui_x = box_left + gi/wavetable_sampleslength*box_width;',
	'\tui_y = box_top + 0.5*(1 - ui_value)*box_height;',
	'\tgfx_lineto(ui_x, ui_y);',
	'\tgi += 1;',
	'\tgi < wavetable_sampleslength;',
	');',
	'gi = 0;',
	'gfx_r = 0.75;',
	'gfx_g = 0.5;',
	'gfx_b = 0.25;',
	'gfx_x = box_left;',
	'gfx_y = box_top + box_height/2;',
	'while (',
	'\tui_value = min(1, max(-1, ui_wavetable_samples[gi*2 + 1]));',
	'\tui_x = box_left + gi/wavetable_sampleslength*box_width;',
	'\tui_y = box_top + 0.5*(1 - ui_value)*box_height;',
	'\tgfx_lineto(ui_x, ui_y);',
	'\tgi += 1;',
	'\tgi < wavetable_sampleslength;',
	');'
], 'box_', {background: [0.05, 0.05, 0.05]});

var code = ui.toString();

var targetFile = process.argv[2];
if (targetFile) {
	fs.writeFileSync(targetFile, source + '\n@gfx\n' + code);
	console.log(code);
} else {
	process.stdout.write(code);
}
