'use strict';
var fs = require('fs');

function testName(name) {
	if (!/^[a-z0-9]/.test(name)) throw new Error('invalid name: ' + name);
}
function indent(code) {
	return {
		toString: function () {
			return '\t' + [].concat(code).join('\n').split('\n').join('\n\t').replace(/\t*$/g, '');
		}
	};
}
function rgbToClear(rgb) {
	function to255(v) {
		return Math.max(0, Math.min(255, Math.round(v*255)));
	}
	return to255(rgb[0]) + 256*to255(rgb[1]) + 65536*to255(rgb[2]);
}
function setColor(rgb) {
	if (rgb[0] === rgb[1] && rgb[1] === rgb[2]) {
		return 'gfx_r = gfx_g = gfx_b = ' + rgb[0] + ';';
	}
	return 'gfx_r = ' + rgb[0] + ';\ngfx_g = ' + rgb[1] + ';\ngfx_b = ' + rgb[2] + ';';
}
function mergeOptions(root, child) {
	var result = {};
	for (var key in root) result[key] = root[key];
	for (var key in child || {}) result[key] = child[key];
	return result;
}

function ScreenSwitcher(screenStackVar, screenCount, screenStep, options) {
	if (!(this instanceof ScreenSwitcher)) return new ScreenSwitcher(options);
	var thisSwitcher = this;

	options = options || {};
	options.background = options.background || [0.95, 0.95, 0.95];
	options.text = options.text || [0, 0, 0];
	options.border = options.border || [0.5, 0.5, 0.5];
	options.buttonOn = options.buttonOn || [0.25, 0.5, 0.75];
	options.buttonOff = options.buttonOff || [1, 1, 1];
	options.buttonTextOn = options.buttonTextOn || [1, 1, 1];
	options.buttonTextOff = options.buttonTextOff || [0, 0, 0];
	if (typeof options.align != 'number') options.align = 0.5;
	if (typeof options.vAlign != 'number') options.vAlign = 0.5;
	options._switcher = this;

	var prefix = options.prefix = options.prefix || 'ui_'
	options.tmp = prefix + 'tmp_';
	var screenLevelVar = prefix + 'screen_level';
	var screenVar = screenStackVar + '[' + screenLevelVar + '*' + screenStep + ']';
	var clickVar = options.click = options.click || prefix + 'click';
	var activeControlVar = options.activeControl = options.activeControl || prefix + 'active_control';
	var texth = options.texth = options.texth || prefix + 'texth';
	var wrapTextFunction = options.wrapText = options.wrapText || prefix + 'wrap_word';
	var alignTextFunction = options.alignText = options.alignText || prefix + 'align_text';
	var pushScreen = options.pushScreen = options.pushScreen || prefix + 'push_screen';
	var popScreen = options.popScreen = options.popScreen || prefix + 'pop_screen';
	var screenSetVar = options.screenSetVar = options.screenSetVar || prefix + 'screen_set';
	var screenGetVar = options.screenGetVar = options.screenGetVar || prefix + 'screen_get';
	
	var defaultScreen = 0;
	var screens = {};
	var prefixCode = [
		'function ' + screenGetVar + '(index) local(screenVars) (',
		indent([
			'screenVars = ' + screenStackVar + ' + ' + screenLevelVar + '*' + screenStep + ' + 1;',
			'screenVars[index];'
		]),
		');',
		'function ' + screenSetVar + '(index, value) local(screenVars) (',
		indent([
			'screenVars = ' + screenStackVar + ' + ' + screenLevelVar + '*' + screenStep + ' + 1;',
			'screenVars[index] = value;'
		]),
		');',
		'function ' + popScreen + '() (',
		indent([screenLevelVar + ' > 0 ? ' + screenLevelVar + ' -= 1;']),
		');',
		'function ' + pushScreen + '(screen_id) local(i, screen) (',
		indent([
			// Leave an extra space so we can return a nonsense
			screenLevelVar + ' + 2 < ' + screenCount + ' ? (',
			indent([
				screenLevelVar + ' += 1;',
				'screen = ' + screenStackVar + ' + ' + screenLevelVar + '*' + screenStep + ';',
				// Clear out the variables
				'i = 0;',
				'while (',
				indent([
					'screen[i] = 0;',
					'i < ' + screenStep
				]),
				');',
				'screen[0] = screen_id;',
				'1'
			]),
			') : 0;'
		]),
		');',
		'gfx_clear = ' + rgbToClear(options.background) + ';',
		'gfx_setfont(1, "Arial", 16);',
		'function ' + alignTextFunction + '(text, left, top, width, height, alignX, alignY) local(text_w, text_h) (',
		indent([
			'gfx_measurestr(text, text_w, text_h);',
			'gfx_x = left + (width - text_w)*alignX;',
			'gfx_y = top + (height - text_h)*alignY;',
			'gfx_drawstr(text);'
		]),
		');',
		'function ' + wrapTextFunction + '(text, whitespace, box_left, box_right) local(text_w text_h) (',
		indent([
			'gfx_measurestr(text, text_w, text_h);',
			'gfx_x + text_w > box_right ? (',
			indent([
				'gfx_x = box_left;',
				'gfx_y += gfx_texth;',
			]),
			');',
			'gfx_drawstr(text);',
			'gfx_drawstr(whitespace);'
		]),
		');',
		texth + ' = gfx_texth;',
		clickVar + ' = mouse_cap&(' + prefix + 'mouse_old~$xff);',
		'!(mouse_cap&1) ? ' + activeControlVar + ' = 0;'
	].join('\n') + '\n';
	var suffixCode = [
		'(',
		indent([
			'gfx_x = gfx_y = gfx_texth;',
			setColor(options.text),
			'gfx_drawstr("Invalid screen: ");',
			'gfx_drawnumber(' + screenVar + ', 5);',
			clickVar + '&1 ? ' + screenLevelVar + ' = ' + screenVar + ' = 0;'
		]),
		');',
		prefix + 'mouse_old = mouse_cap;'
	].join('\n');
	this.toString = function () {
		var code = prefixCode;
		code += '!' + screenVar + ' ? ' + screenVar + ' = ' + defaultScreen + ';';
		code += 'default_screen = ' + defaultScreen + ';\n';
		for (var screenId in screens) {
			code += screenVar + ' == ' + screenId + ' ? (\n';
			code += indent(screens[screenId]);
			code += '\n) : ';
		}
		return code + suffixCode;
	};

	this.openScreen = function (screenId) {
		if (typeof screenId == 'string') screenId = JSON.stringify(screenId);
		if (typeof screenId === 'object') {
			screenId = screenId.code;
		}
		var args = [].slice.call(arguments, 1);
		var tmpScreen = options.tmp + 'screen';
		var code = tmpScreen + ' = ' + pushScreen + '(' + screenId + ');';
		args.forEach(function (arg, index) {
			code += '\n' + tmpScreen + '[' + index + '] = ' + arg + ';'
		});
		return code;
	};
	var screenIdCounter = 1;
	this.screen = function (screenId) {
		var screenId = screenId || screenIdCounter++;
		if (typeof screenId == 'string') screenId = JSON.stringify(screenId);
		defaultScreen = defaultScreen || screenId;

		var box = new DrawBox(0, 0, 'gfx_w', 'gfx_h', 'gfx_w', 'gfx_h');
		var screen = new Component(box, mergeOptions(options, {prefix: prefix + 'screen' + screenId + '_'}));
		screen.open = function () {
			var args = [].slice.call(arguments, 0);
			return thisSwitcher.openScreen([screenId].concat(args));
		};
		screen.close = function () {
			return popScreen + '()';
		};
		screens[screenId] = screen;
		return screen;
	};
	var uniqueIdCounter = 1;
	this.uniqueVar = function () {
		return prefix + 'var' + (uniqueIdCounter++);
	};
	this.uniqueValue = function () {
		return uniqueIdCounter++;
	};
	this.texth = texth;
}

function addDimensions(a, b) {
	if (!a) return b;
	if (!b) return a;
	return '(' + a + ' + ' + b + ')';
}

function subDimensions(a, b) {
	if ((b + "")[0] === '-') return addDimensions(a, (b + "").substr(1));
	if (!b) return a;
	return '(' + a + ' - ' + b + ')';
}

function DrawBox(left, top, width, height, right, bottom) {
	this.left = left;
	this.top = top;
	this.width = width;
	this.height = height;
	this.right = right;
	this.bottom = bottom;

	this.setTop = function (top) {
		return new DrawBox(left, top, width, subDimensions(bottom, top), right, bottom);
	};

	this.addTop = function (diff) {
		return this.inset(0, diff, 0, 0);
	};
	this.addBottom = function (diff) {
		return this.inset(0, 0, 0, diff);
	};
	this.addLeft = function (diff) {
		return this.inset(diff, 0, 0, 0);
	};
	this.addRight = function (diff) {
		return this.inset(0, 0, diff, 0);
	};

	this.setHeight = function (height) {
		return new DrawBox(left, top, width, height, right, addDimensions(top, height));
	};
	this.setHeightFromBottom = function (height) {
		return new DrawBox(left, subDimensions(bottom, height), width, height, right, bottom);
	};
	this.setWidth = function (width) {
		return new DrawBox(left, top, width, height, addDimensions(left, width), bottom);
	};
	this.setWidthFromRight = function (width) {
		return new DrawBox(subDimensions(right, width), top, width, height, right, bottom);
	};

	this.inset = function (l, t, r, b) {
		return new DrawBox(
			addDimensions(left, l),
			addDimensions(top, t),
			subDimensions(width, addDimensions(l, r)),
			subDimensions(height, addDimensions(t, b)),
			subDimensions(right, r),
			subDimensions(bottom, b)
		);
	};
}

function Component(initBox, options) {
	var thisComponent = this;
	this.box = initBox;
	this.texth = options.texth;
	this._showCode = options._showCode;
	var components = [];
	this.toString = function () {
		return components.join('\n');
	};
	
	this.color = function (text, background) {
		var newOpts = {};
		var box = this.box;
		if (text) {
			newOpts.text = text;
		}
		if (background) {
			components.unshift('gfx_rect(' + [box.left, box.top, box.width, box.height].join(', ') + ');')
			components.unshift(setColor(background));
			newOpts.background = background;
		}
		options = mergeOptions(options, newOpts);
		return this;
	};
	
	this.splitX = function (ratio, extraOptions) {
		return this.left(ratio + '*' + this.box.width, extraOptions);
	};
	this.splitY = function (ratio, extraOptions) {
		return this.top(ratio + '*' + this.box.height, extraOptions);
	};
	this.left = function (width, extraOptions) {
		var box = this.box;
		var child = new Component(box.setWidth(width), mergeOptions(options, extraOptions));
		components.push(child);
		this.box = box.addLeft(width);
		return child;
	};
	this.right = function (width, extraOptions) {
		var box = this.box;
		var child = new Component(box.setWidthFromRight(width), mergeOptions(options, extraOptions));
		components.push(child);
		this.box = box.addRight(width);
		return child;
	};
	this.top = function (height, extraOptions) {
		var box = this.box;
		var child = new Component(box.setHeight(height), mergeOptions(options, extraOptions));
		components.push(child);
		this.box = box.addTop(height);
		return child;
	};
	this.bottom = function (height, extraOptions) {
		var box = this.box;
		var child = new Component(box.setHeightFromBottom(height), mergeOptions(options, extraOptions));
		components.push(child);
		this.box = box.addBottom(height);
		return child;
	};
	this.inset = function (left, top, right, bottom, extraOptions) {
		if (!top && typeof top !== 'number') top = left;
		if (!right && typeof right !== 'number') right = left;
		if (!bottom && typeof bottom !== 'number') bottom = top;
		var child = new Component(this.box.inset(left, top, right, bottom), mergeOptions(options, extraOptions));
		components.push(child);
		return child;
	};
	
	this.textExpr = function (expr, extraOptions) {
		var opts = mergeOptions(options, extraOptions);
		var box = this.box;
		components.push(setColor(opts.text));
		components.push(opts.alignText + '(' + [expr, box.left, box.top, box.width, box.height, opts.align, 0.5].join(', ') + ');');
		return this;
	}
	this.text = function (string, extraOptions) {
		return this.textExpr(JSON.stringify(string), extraOptions);
	};
	this.printf = function (string) {
		var extraOptions;
		var args = [].slice.call(arguments, 1);
		if (args.length && typeof args[args.length - 1] === 'object') {
			extraOptions = args.pop();
		}
		var tmpVar = options.tmp + 'text';
		components.push(tmpVar + ' = #' + tmpVar + ';');
		components.push('sprintf(' + [tmpVar, JSON.stringify(string)].concat(args).join(', ') + ');');
		return this.textExpr(tmpVar, extraOptions);
	};
	this.wrapText = function (string, extraOptions) {
		var box = this.box;
		var opts = mergeOptions(options, extraOptions);
		components.push(setColor(opts.text));
		components.push('gfx_y = ' + box.top + ';');

		components.push(options.tmp + 'left = ' + box.left + ';');
		components.push(options.tmp + 'right = ' + box.right + ';');
		string.split('\n').forEach(function (line) {
			components.push('gfx_x = ' + box.left + ';');
			line.replace(/([^\s]+)(\s*)/g, function (match, word, whitespace) {
				components.push(opts.wrapText + '(' + JSON.stringify(word) + ', ' + JSON.stringify(whitespace) + ', ' + options.tmp + 'left, ' + options.tmp + 'right);');
			});
			components.push('gfx_y += gfx_texth;');
		});
		var bottomVar = options._switcher.uniqueVar();
		components.push(bottomVar + ' = gfx_y;');
		this.box = box.setTop(bottomVar);
		return this;
	};
	
	this.indicator = function (test, extraOptions) {
		var opts = mergeOptions(options, extraOptions);

		var onBackground = opts.buttonOn || opts.text;
		var offBackground = opts.buttonOff || opts.background;
		var onText = opts.buttonTextOn || opts.background;
		var offText = opts.buttonTextOff || opts.text;
		var border = opts.buttonBorder || opts.border;
		var background = [0, 0, 0].map(function (t, i) {
			return test + ' ? ' + onBackground[i] + ':' + offBackground[i];
		});
		var text = [0, 0, 0].map(function (t, i) {
			return test + ' ? ' + onText[i] + ':' + offText[i];
		});
		
		return this.border(border).color(text, background);
	};
	this.border = function (color, extraOptions) {
		var opts = mergeOptions(options, extraOptions);
		var box = this.box;
		components.push(setColor(color || options.border));
		components.push('gfx_x = ' + box.left + ';');
		components.push('gfx_y = ' + box.top + ';');
		components.push('gfx_lineto(' + box.right + ' - 1, gfx_y);');
		components.push('gfx_lineto(gfx_x, ' + box.bottom + ' - 1);');
		components.push('gfx_lineto(' + box.left + ', gfx_y);');
		components.push('gfx_lineto(gfx_x, ' + box.top + ');');
		return this.inset(1, 1, 1, 1, extraOptions);
	};
	this.actionButton = function (action, extraOptions) {
		return this.button('0', action, '0', extraOptions);
	};
	this.button = function (test, turnOn, turnOff, extraOptions) {
		if (!turnOn) turnOn = test + ' = 1';
		if (!turnOff) turnOff = test + ' = 0';
		var indicator = this.indicator(test, extraOptions);
		var box = indicator.box;
		var clickTest = '(' + options.click + '&1 && mouse_x >= ' + box.left + ' && mouse_x <= ' + box.right + ' && mouse_y >= ' + box.top + '&& mouse_y <= ' + box.bottom + ')';
		components.push(clickTest + ' ? (');
		components.push(indent([
			test + ' ? (',
			indent(turnOff),
			') : (',
			indent(turnOn),
			')'
		]));
		components.push(');');
		return indicator;
	};
	this.hslider = function (varName, readFunction, writeFunction, onchange, extraParams, extraOptions) {
		var opts = mergeOptions(options, extraOptions);
		var offBackground = opts.buttonOff || opts.background;
		var onBackground = opts.buttonOn || opts.background;
		var border = opts.buttonBorder || opts.border;

		var slider = this.border(border).color(null, offBackground);
		var box = slider.box;
		var clickTest = '(' + options.click + '&1 && mouse_x >= ' + box.left + ' && mouse_x <= ' + box.right + ' && mouse_y >= ' + box.top + '&& mouse_y <= ' + box.bottom + ')';
		
		var ratioExpr = readFunction ? readFunction + '(' + [varName].concat(extraParams).join(', ') + ')' : varName;
		var clickRatioExpr = 'max(0, min(1, (mouse_x - ' + box.left + ')/(' + box.width + ')))';
		var assignExpr = writeFunction ? writeFunction + '(' + [clickRatioExpr].concat(extraParams).join(', ') + ')' : clickRatioExpr;
		
		components.push(slider);
		components.push(setColor(onBackground));
		components.push('gfx_rect(' + [box.left, box.top, 'floor(' + box.width + '*' + ratioExpr + ' + 0.5)', box.height].join(', ') + ');');
		var controlId = opts._switcher.uniqueValue();
		components.push(clickTest + ' ? ' + opts.activeControl + ' = ' + controlId + ';');
		components.push(opts.activeControl + ' == ' + controlId + ' ? (');
		components.push(indent([
			varName + ' = ' + assignExpr + ';'
		]));
		if (onchange) components.push(indent([onchange]));
		components.push(');');
		return this;
	};
	
	this.code = function (code, boxVars, codeOptions) {
		boxVars = boxVars || {};
		if (typeof boxVars === 'string') {
			boxVars = {
				left: boxVars + 'left',
				top: boxVars + 'top',
				width: boxVars + 'width',
				height: boxVars + 'height',
				right: boxVars + 'right',
				bottom: boxVars + 'bottom'
			};
		}
		var box = this.box;
		if ('left' in boxVars) components.push(boxVars.left + ' = ' + box.left + ';');
		if ('top' in boxVars) components.push(boxVars.top + ' = ' + box.top + ';');
		if ('width' in boxVars) components.push(boxVars.width + ' = ' + box.width + ';');
		if ('height' in boxVars) components.push(boxVars.height + ' = ' + box.height + ';');
		if ('right' in boxVars) components.push(boxVars.right + ' = ' + box.right + ';');
		if ('bottom' in boxVars) components.push(boxVars.bottom + ' = ' + box.bottom + ';');
		
		if (codeOptions.background) {
			components.push(setColor(codeOptions.background));
			components.push('gfx_rect(' + [box.left, box.top, box.width, box.height].join(', ') + ');');
		}
		
		components.push('( // Custom graphics code');
		components.push(indent(code));
		components.push(');');
	};
}

module.exports = ScreenSwitcher;