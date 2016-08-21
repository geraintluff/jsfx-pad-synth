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

function ScreenSwitcher(options) {
	if (!(this instanceof ScreenSwitcher)) return new ScreenSwitcher(options);

	options = options || {};
	options.background = options.background || [0.95, 0.95, 0.95];
	options.text = options.text || [0, 0, 0];
	options.border = options.border || [0.5, 0.5, 0.5];
	options.buttonOn = options.buttonOn || [0.25, 0.5, 0.75];
	options.buttonOff = options.buttonOff || [1, 1, 1];
	options.buttonTextOn = options.buttonTextOn || [1, 1, 1];
	options.buttonTextOff = options.buttonTextOff || [0, 0, 0];
	if (typeof options.align != 'number') options.align = 0.5;
	options._switcher = this;

	var prefix = options.prefix = options.prefix || 'ui_'
	options.tmp = prefix + 'tmp_';
	var screenVar = prefix + 'screen';
	var clickVar = options.click = options.click || prefix + 'click';
	var texth = options.texth = options.texth || prefix + 'texth';

	var screens = {};
	var prefixCode = [
		'gfx_clear = ' + rgbToClear(options.background) + ';',
		'gfx_setfont(1, "Arial", 16);',
		texth + ' = gfx_texth;',
		clickVar + ' = mouse_cap&(' + prefix + 'mouse_old~$xff);'
	].join('\n') + '\n';
	var suffixCode = [
		'(',
		indent([
			'gfx_x = gfx_y = gfx_texth;',
			setColor(options.text),
			'gfx_drawstr("Invalid screen: ");',
			'gfx_drawnumber(' + screenVar + ', 5);'
		]),
		');',
		prefix + 'mouse_old = mouse_cap;'
	].join('\n');
	this.toString = function () {
		var code = prefixCode;
		for (var screenId in screens) {
			code += screenVar + ' == ' + screenId + ' ? (\n';
			code += indent(screens[screenId]);
			code += '\n) : ';
		}
		return code + suffixCode;
	};

	var screenIdCounter = 0;
	this.screen = function () {
		var box = new DrawBox(0, 0, 'gfx_w', 'gfx_h', 'gfx_w', 'gfx_h');
		var screenId = screenIdCounter++;
		var showCode = screenVar + ' = ' + screenId + ';';
		var screen = new Component(box, mergeOptions(options, {prefix: prefix + 'screen' + screenId + '_', _showCode: showCode}));
		screens[screenId] = screen;
		return screen;
	};
	var uniqueIdCounter = 0;
	this.uniqueVar = function () {
		return prefix + 'var' + (uniqueIdCounter++);
	};
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

	this.addTop = function (diff) {
		return this.inset(0, diff, 0, 0);
	};
	this.setHeight = function (height) {
		return new DrawBox(left, top, width, height, right, addDimensions(top, height));
	};
	this.setTop = function (top) {
		return new DrawBox(left, top, width, subDimensions(bottom, top), right, bottom);
	};
	this.addLeft = function (diff) {
		return this.inset(diff, 0, 0, 0);
	};
	this.setWidth = function (width) {
		return new DrawBox(left, top, width, height, addDimensions(left, width), bottom);
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
		extraOptions = extraOptions || {};
		var opts = mergeOptions(options, extraOptions);
		var box = this.box;
		var childBox = box.setWidth(width);
		var child = new Component(childBox, opts);
		components.push(child);
		if (extraOptions.line) {
			components.push(setColor(options.border));
			components.push('gfx_line(' + [childBox.right, childBox.top, childBox.right, childBox.bottom].join(', ') + ');');
		}
		this.box = box.addLeft(width);
		return child;
	};
	this.top = function (height, extraOptions) {
		extraOptions = extraOptions || {};
		var opts = mergeOptions(options, extraOptions);
		var box = this.box;
		var childBox = box.setHeight(height);
		var child = new Component(childBox, opts);
		components.push(child);
		if (extraOptions.line) {
			components.push(setColor(options.border));
			components.push('gfx_line(' + [box.left, childBox.bottom, box.right, childBox.bottom].join(', ') + ');');
		}
		this.box = box.addTop(height);
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
		components.push(options.tmp + 'text = ' + expr + ';');
		components.push('gfx_measurestr(' + options.tmp + 'text, ' + options.tmp + 'text_w, ' + options.tmp + 'text_h);');
		components.push('gfx_x = ' + box.left + ' + (' + box.width + ' - ' + options.tmp + 'text_w)*' + opts.align + ';');
		components.push('gfx_y = ' + box.top + ' + (' + box.height + ' - ' + options.tmp + 'text_h)/2;');
		components.push('gfx_drawstr(' + options.tmp + 'text);');
		return this;
	}
	this.text = function (string, extraOptions) {
		return this.textExpr(JSON.stringify(string), extraOptions);
	};
	this.wrapTextExprs = function (exprs, extraOptions) {
		var box = this.box;
		var opts = mergeOptions(options, extraOptions);
		components.push(setColor(opts.text));
		components.push('gfx_x = ' + box.left + ';');
		components.push('gfx_y = ' + box.top + ';');

		exprs.forEach(function (expr) {
			components.push(options.tmp + 'text = ' + expr + ';');
			components.push('gfx_measurestr(' + options.tmp + 'text, ' + options.tmp + 'text_w, ' + options.tmp + 'text_h);');
			components.push('gfx_x + ' + options.tmp + 'text_w > ' + box.right + ' ? (');
			components.push(indent([
				'gfx_x = ' + box.left + ';',
				'gfx_y += gfx_texth'
			]));
			components.push(');');
			components.push('gfx_printf(' + options.tmp + 'text);');
		});
		var bottomVar = options._switcher.uniqueVar();
		components.push(bottomVar + ' = gfx_y + gfx_texth;');
		
		this.box = box.setTop(bottomVar);
		return this;
	};
	this.wrapText = function (string, extraOptions) {
		string.split('\n').forEach(function (line) {
			var parts = line.match(/[^\s]+(\s|$)/g);
			if (!parts) {
				thisComponent.box = thisComponent.box.addTop('gfx_texth');
			} else {
				return thisComponent.wrapTextExprs(parts.map(JSON.stringify), extraOptions);
			}
		});
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
		
		var button = this.border(border).color(text, background);
		var box = button.box;
		components.push(button);
		return button;
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
		return this.inset(1, 1, 1, 1, extraOptions)
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
	this.subView = function (text, extraOptions) {
		var opts = mergeOptions(options, extraOptions);
		var screen = options._switcher.screen(text);
		this.button('0', screen._showCode, '0', opts).text(text);
		var navBar = screen.top(this.texth + '*1.5').left(this.texth + '*10');
		navBar.button('0', this._showCode, '0').text('< back');
		return screen;
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