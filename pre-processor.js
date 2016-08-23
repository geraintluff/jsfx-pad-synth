'use strict';
function functionRefs(source) {
	var functionSwitcherSets = {};
	var declarationRegex = /function\s*\{\s*([a-z0-9_\.]+)\s*\}\s*\(\s*([a-z0-9_\.]+\s*(,\s*[a-z0-9_\.]+\s*)*)?\)/g;
	
	source = source.replace(declarationRegex, function (match, groupName, args) {
		var argNames = args ? args.split(/,\s*/g) : [];
		argNames = argNames.map(function (name, index) {
			if (/^arg[0-9]+$/.test(name) || name === 'function_id') return 'arg' + index;
			return name;
		});
		functionSwitcherSets[groupName] = {
			counter: 0,
			functions: [],
			map: {},
			argNames: argNames,
		};
		return match;
	});
	
	source = source.replace(/\{\s*([a-z0-9_\.]+)\s*\}\s*([a-z0-9_\.]+)/ig, function (match, groupName, funcName) {
		var group = functionSwitcherSets[groupName];
		if (!group) throw new Error('No function group defined for {' + groupName + '}' + funcName);
		if (!(funcName in group.map)) {
			group.map[funcName] = group.counter++;
			group.functions.push(funcName);
		}
		return group.map[funcName] + '/*' + funcName + '*/';
	});

	source = source.replace(declarationRegex, function (match, groupName, args) {
		var group = functionSwitcherSets[groupName];
		if (!group) throw new Error('No function group for: ' + funName);
		var switcherCode = 'function ' + groupName + '(' + ['function_id'].concat(group.argNames).join(', ') + ') (\n';
		group.functions.forEach(function (func, index) {
			if (index > 0) switcherCode += '\n: ';
			switcherCode += '\tfunction_id == ' + index + ' ? ' + func + '(' + group.argNames.join(', ') + ')';
		});
		switcherCode += ';\n)';
		return switcherCode;
	});

	source = source.replace(/\{\s*([a-z0-9_\.]+)\s*\:([^}]*)\}\s*\(\s*([^)]*)/g, function (match, groupName, expr, untilCloseBrackets) {
		var group = functionSwitcherSets[groupName];
		if (!group) throw new Error('No function group defined for {' + groupName + ':' + expr + '}');
		return groupName + '(' + expr + (untilCloseBrackets ? ', ' + untilCloseBrackets : ')');
	});
	
	return source;
};

function arrowProperties(source) {
	var propertyGroups = {};
	source = source.replace(/->\s*([a-z0-9\-\_\.]+)/g, function (match, key) {
		var fullKey = key;
		var parts = key.split('.');
		var prefix = (parts.length > 1) ? parts.shift() : '';
		key = parts.join('.');

		var group = propertyGroups[prefix] = propertyGroups[prefix] || {
			counter: 0,
			keys: [],
			map: {}
		};
		if (!(key in group.map)) {
			group.map[key] = group.counter++;
			group.keys.push(fullKey);
		}
		return '[' + group.map[key] + '/*' + fullKey + '*/]';
	});
	function groupLength(prefix) {
		var group = propertyGroups[prefix];
		return group ? group.counter  + '/* ' + group.keys.join(', ') + ' */' : 0;
	}
	source = source.replace(/##/, function () {
		return groupLength('');
	});
	source = source.replace(/([a-z0-9\-\_\.]+)#/g, function (match, prefix) {
		return groupLength(prefix);
	});
	
	
	return source;
};

module.exports = function (source) {
	return functionRefs(arrowProperties(source));
};