var fs = require('fs');
var JsfxUi = require('./jsfx-ui');

var source = fs.readFileSync(__dirname + '/pad-synth.txt');

var ui = new JsfxUi();
var main = ui.screen('main');

// Main
var top = main.top('25', {line: true}).color(null, [1, 1, 1]).border();
top.text('PadSynth').text('by Geraint Luff', {text: [0.5, 0.5, 0.5], align: 1});
var body = main.inset(20, 10);
var buttonBar = body.top(25).inset(0, 0, 0, 5);

buttonBar.splitX(1/3).button('can_recompute', 'action_recompute = 1', 'action_recompute = 1;').text('Recompute');
var adsr = buttonBar.splitX(0.5).subView('Envelope (ADSR)');

var group = adsr.splitY(0.5).inset(5).border();
group.top(30).text('Amplitude');
var control = group.top('25').inset(5);
control.left(50).text('Attack');
control.right(50).printf('%i ms', 'param_attack*1000 + 0.5');
control.hslider('param_attack', 'power_to_slider', 'slider_to_power', null, [0.001, 1.5, 3]);
var control = group.top('25').inset(5);
control.left(50).text('Decay');
control.right(50).printf('%i ms', 'param_decay*1000 + 0.5');
control.hslider('param_decay', 'power_to_slider', 'slider_to_power', null, [0.01, 5, 3]);
var control = group.top('25').inset(5);
control.left(50).text('Sustain');
control.right(50).printf('%i%%', 'param_sustain*100 + 0.5');
control.hslider('param_sustain', 'range_to_slider', 'slider_to_range', null, [0, 1]);
var control = group.top('25').inset(5);
control.left(50).text('Release');
control.right(50).printf('%i ms', 'param_release*1000 + 0.5');
control.hslider('param_release', 'power_to_slider', 'slider_to_power', null, [0.005, 5, 3]);
var control = group.top(40).inset(5);
control.left(50);
control.splitX(0.25).button('param_env_linear').text('Linear');

var aboutPage = buttonBar.subView('About');
aboutPage.splitY(0.3).text('About');
aboutPage.wrapText('This is an implementation of the "padsynth" algorithm from ZynAddSubFX.  The samples are designed in the frequency domain (which allows customised harmonic spread) and then generated using an inverse FFT.\n\nThe GUI for this synth is generated in JavaScript.');
aboutPage.text('Remainder');

var controllers = body.bottom(50).inset(5);
controllers.right(50).printf('%i', 'floor(param_width_cents + 0.5)');
controllers.hslider('param_width_cents', 'log_to_slider', 'slider_to_log', 'can_recompute = 1', [2, 200]);

var waveform = body;
waveform.code([
	'ui_wavetable = wavetables_start + display_wavetable_index*wavetable_step;',
	'ui_wavetable_samples = ui_wavetable + wavetable_headerlength;',
	'gis = ceil(ui_wavetable_samples*0.25/box_width);',
	// Left - blue
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
	'\tgfx_lineto(ui_x, ui_y, 0);',
	'\tgi += 1;',
	'\tgi < wavetable_sampleslength;',
	');',
	// Right - orange
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
	'\tgfx_lineto(ui_x, ui_y, 0);',
	'\tgi += 1;',
	'\tgi < wavetable_sampleslength;',
	');'
], 'box_', {background: [0.05, 0.05, 0.05]});

var gfxCode = ui.toString();

function serializeVariables(varMap) {
	var idMap = {};
	for (var key in varMap) {
		var id = varMap[key];
		if (idMap[id]) throw new Error('duplicate variable ID (' + id + '): ' + key + ' + ' + idMap[id]);
		idMap[id] = key;
	}
	var code = [];
	code.push('function read_var() local(var_id) (\n');
	code.push('\tfile_var(0, var_id);\n');
	for (var id in idMap) {
		code.push('\tvar_id == ' + id + ' ? (\n');
		code.push('\t\tfile_var(0, ' + idMap[id] + ');\n');
		code.push('\t) :');
	}
	code.push('(\n');
	code.push('\t\tfile_var(0, var_id); // Ignore unknown variables\n');
	code.push('\t);\n');
	code.push(');\n');
	code.push('file_avail(0) >= 0 ? (\n');
	code.push('\treset_to_defaults(); // Also queues up a recompute\n');
	code.push('\tfile_avail(0) ? while (\n');
	code.push('\t\tread_var();\n');
	code.push('\t\tfile_avail(0);\n');
	code.push('\t);\n');
	code.push(') : (\n');
	for (var key in varMap) {
		code.push('\tvar_id = ' + varMap[key] + ';\n');
		code.push('\tfile_var(0, var_id);\n');
		code.push('\tfile_var(0, ' + key + ');\n');
	}
	code.push(');\n');
	return code.join('');
}
var serializeCode = serializeVariables({
	param_width_cents: 1,
	param_attack: 100,
	param_decay: 101,
	param_sustain: 102,
	param_release: 103,
	param_env_linear: 99
});

var genCode = source + '\n@serialize\n' + serializeCode + '\n@gfx\n' + gfxCode;
var targetFile = process.argv[2];
if (targetFile) {
	fs.writeFileSync(targetFile, genCode);
	console.log(genCode);
} else {
	process.stdout.write(genCode);
}
