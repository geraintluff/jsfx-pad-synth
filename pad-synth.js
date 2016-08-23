var fs = require('fs');
var JsfxUi = require('./jsfx-ui');

var source = fs.readFileSync(__dirname + '/pad-synth.txt', {encoding: 'utf-8'});

var ui = new JsfxUi('screen_stack', 'screen_count', 'screen_step');
var main = ui.screen('main');
// Main
var top = main.top('25', {line: true});
top.actionButton(ui.openScreen('about')).text('PadSynth');
var body = main.inset(20, 10);
var buttonBar = body.top(25).inset(0, 0, 0, 5);

buttonBar.splitX(0.5).actionButton(ui.openScreen('envelope')).text('Envelope (ADSR)');
buttonBar.actionButton(ui.openScreen({code: '(fx_spec_start + (fx_list_start + 0*fx_list_step)[FX#INDEX]*fx_spec_step)[FX_HEADER#SPEC_SCREEN]'}, '(fx_list_start + 0*fx_list_step)')).text('LFO');

var envelopePage = ui.screen('envelope');
addBackButton(envelopePage);

function sliderSet(host, sliders, extra) {
	var remaining = sliders.length + (extra || 0);
	[].concat(sliders).forEach(function (slider) {
		var subHost = remaining > 1 ? (host.splitY(1/remaining)) : host;
		remaining--;
		var control = subHost;
		control.left(80).inset(5).text(slider.name, {align: 1});
		var display = control.right(80).inset(5, 0, 0, 0);
		display.printf.apply(display, slider.printf.concat([{align: 0}]));
		control = control.inset(5);
		control.hslider.apply(control, slider.slider);
	});
}
var group = envelopePage.splitY(0.5).inset(5).border().inset(5);
group.top(30).text('Amplitude');
sliderSet(group, [
	{
		name: 'Attack',
		printf: ['%i ms', 'param_attack*1000 + 0.5'],
		slider: ['param_attack', 'power_to_slider', 'slider_to_power', null, [0.001, 1.5, 3]]
	},
	{
		name: 'Decay',
		printf: ['%i ms', 'param_decay*1000 + 0.5'],
		slider: ['param_decay', 'power_to_slider', 'slider_to_power', null, [0.001, 5, 3]]
	},
	{
		name: 'Sustain',
		printf: ['%i%%', 'param_sustain*100 + 0.5'],
		slider: ['param_sustain', 'power_to_slider', 'slider_to_power', null, [0, 1, 1]]
	},
	{
		name: 'Release',
		printf: ['%i ms', 'param_release*1000 + 0.5'],
		slider: ['param_release', 'power_to_slider', 'slider_to_power', null, [0.005, 5, 3]]
	},
], 1);

group.left(50);
group.right(80).button('param_env_linear').text('Linear');

var footer = body.bottom(50).inset(5);
footer.right(100).button('can_recompute', 'action_recompute = 1', 'action_recompute = 1;').text('Recompute');
var controllers = footer.inset(5);
sliderSet(controllers, [
	{
		name: 'Width (cents)',
		printf: ['%i', 'floor(param_width_cents + 0.5)'],
		slider: ['param_width_cents', 'power_to_slider', 'slider_to_power', 'can_recompute = 1', [5, 200, 3]]
	}
]);

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

function addBackButton(screen) {
	var navBar = screen.top(ui.texth + '*1.5').left(ui.texth + '*10');
	navBar.actionButton(screen.close()).text('< back');
	return screen;
}

var aboutPage = ui.screen('about');
addBackButton(aboutPage);
aboutPage.splitY(0.1);
aboutPage.top(20).text('PadSynth');
aboutPage.top(20).text('by Geraint Luff', {text: [0.5, 0.5, 0.5]});
aboutPage.inset(40, 40).wrapText('This is a JSFX implementation of the "padsynth" algorithm from ZynAddSubFX, which I love but hasn\'t been updated in a while.  It\'s not a complete replacement, but I\'m adding features as I need them.\n\nIt\'s a sample-based synth, where the samples are designed in the frequency domain (which allows customised harmonic spread) and then generated using an inverse FFT.\n\nThe GUI for this synth is generated in JavaScript.');

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
	code.push('\taction_recompute = 1;\n');
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

var preProcess = require('./pre-processor');

var genCode = source + '\n@serialize\n' + serializeCode;
genCode = preProcess(genCode);
var targetFile = process.argv[2];
if (targetFile) {
	fs.writeFileSync(targetFile, genCode);
} else {
	process.stdout.write(genCode);
}
var targetFile2 = process.argv[3];
if (targetFile2) {
	gfxLibCode = fs.readFileSync(__dirname + '/ui-lib.jsfx-inc', {encoding: 'utf-8'});
	gfxLibCode = preProcess(gfxLibCode);
	fs.writeFileSync(targetFile2, gfxLibCode);
}