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
	options = options || {};
	options.background = options.background || [1, 1, 1]; // [0.95, 0.95, 0.95];
	options.text = options.text || [0, 0, 0];
	options.border = options.border || [0.5, 0.5, 0.5];

	var prefix = options.prefix = options.prefix || 'ui_'
	var screenVar = prefix + 'screen';
	var defaultScreen = null;
	
	var components = ['gfx_clear = ' + rgbToClear(options.background) + ';'];
	components.push('gfx_setfont(1, "Arial", 16);');
	var suffixCode = [
		'(',
		indent([
			'gfx_x = gfx_y = gfx_texth;',
			setColor(options.text),
			'gfx_drawstr("Invalid screen: ");',
			'gfx_drawnumber(' + screenVar + ', 5);'
		]),
		');'
	];
	this.toString = function () {
		return components.concat(suffixCode).join('\n');
	};

	
	var idMap = {};
	var idCounter = 0;
	this.screen = function (name) {
		testName(name);
		defaultScreen = defaultScreen || name;
		var id = idCounter++;
		idMap[name] = id;
		
		var box = new DrawBox(0, 0, 'gfx_w', 'gfx_h', 'gfx_w', 'gfx_h');
		var screen = new Component(box, options);
		
		components.push(screenVar + ' == ' + id + ' ? (');
		components.push(indent(screen));
		components.push(') : ');
		return screen;
	};
	function uiCodeForScreen(id, screen, varName, options) {
		return code;
	}
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
		return new DrawBox(left, top, width, height, right, '(' + top + ' + ' + height + ')');
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
	this.box = initBox;
	var components = [];
	this.toString = function () {
		return components.join('\n');
	};
	
	this.split = function (ratio, extraOptions) {
		return this.top(ratio + '*' + this.box.height, extraOptions);
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
	this.inset = function (left, top, right, bottom) {
		if (!top && typeof top !== 'number') top = left;
		if (!right && typeof right !== 'number') right = left;
		if (!bottom && typeof bottom !== 'number') bottom = top;
		var child = new Component(this.box.inset(left, top, right, bottom), options);
		components.push(child);
		return child;
	};
	this.background = function (color) {
		var box = this.box;
		options = mergeOptions(options, {background: color});
		components.push(setColor(color));
		components.push('gfx_rect(' + [box.left, box.top, box.width, box.height].join(', ') + ');');
		return this;
	};
	
	this.textExpr = function (expr, extraOptions) {
		var opts = mergeOptions(options, extraOptions);
		var box = this.box;
		components.push(setColor(opts.text));
		components.push(options.prefix + 'text = ' + expr + ';');
		components.push('gfx_measurestr(' + options.prefix + 'text, ' + options.prefix + 'text_w, ' + options.prefix + 'text_h);');
		components.push('gfx_x = ' + box.left + ' + (' + box.width + ' - ' + options.prefix + 'text_w)/2;');
		components.push('gfx_y = ' + box.top + ' + (' + box.height + ' - ' + options.prefix + 'text_h)/2;');
		components.push('gfx_drawstr(' + expr + ');');
		return this;
	}
	this.text = function (string, extraOptions) {
		return this.textExpr(JSON.stringify(string), extraOptions);
	};
	
	this.code = function (code, boxVars) {
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
		components.push('( // Custom graphics code');
		components.push(indent(code));
		components.push(');');
	};
}

module.exports = ScreenSwitcher;