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
			counter: 1,
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
		switcherCode += '\tfunction_id ? (\n';
		group.functions.forEach(function (func, index) {
			if (index > 0) {
				switcherCode += '\n\t\t: ';
			} else {
				switcherCode += '\t\t';
			}
			switcherCode += 'function_id == ' + group.map[func] + ' ? ' + func + '(' + group.argNames.join(', ') + ')';
		});
		switcherCode += '\n\t);\n);'
		return switcherCode;
	});

	source = source.replace(/\{\s*([a-z0-9_\.]+)\s*\:([^}]*)\}\s*\(\s*([^)]*)/g, function (match, groupName, expr, untilCloseBrackets) {
		var group = functionSwitcherSets[groupName];
		if (!group) throw new Error('No function group defined for {' + groupName + ':' + expr + '}');
		return groupName + '(' + expr + (untilCloseBrackets ? ', ' + untilCloseBrackets : ')');
	});
	
	return source;
};

function autoEnums(source) {
	var groups = {};
	function getGroup(key) {
		return groups[key] = groups[key] || {
			counter: 0,
			countingRefs: 0,
			values: [],
			map: {},
			fixedVars: {}
		};
	}
	source = source.replace(/([a-z0-9\-\_\.]+)#([a-z0-9\-\_\.]+)\(([0-9]+)\)/gi, function (match, key, suffix, forceNumber) {
		var group = getGroup(key);
		var n = parseFloat(forceNumber);
		if (isNaN(n)) throw new Error('Invalid enum forcing: ' + match);
		group.counter = Math.max(n + 1, group.counter);
		if ((n in group.fixedVars) && group.fixedVars[n] !== suffix) {
			throw new Error('Conflicting enum forcing for ' + n + ' in ' + key + ': ' + suffix + ' and ' + group.fixedVars[n]);
		}
		if (suffix in group.map && parseFloat(group.map[suffix]) !== n) {
			throw new Error('Conflicting enum forcing for ' + suffix + ': ' + parseFloat(group.map[suffix]) + ' and ' + n);
		}
		group.fixedVars[n] = suffix;
		group.map[suffix] = n + '/*' + key + ':' + suffix + '*/';
		return key + '#' + suffix;
	});
	source = source.replace(/([a-z0-9\-\_\.]+)#([a-z0-9\-\_\.]+)/gi, function (match, key, suffix) {
		var group = getGroup(key);
		if (suffix in group.map) {
			return group.map[suffix];
		} else {
			group.values.push(suffix);
			return group.map[suffix] = (group.counter++) + '/*' + key + ':' + suffix + '*/';
		}
	});
	source = source.replace(/([a-z0-9\-\_\.]+)#(#?)/gi, function (match, key, forceOnlyCount) {
		var group = getGroup(key);
		if (!group.counter) throw new Error('Reference to undefined group: ' + match);
		group.countingRefs++;
		if (forceOnlyCount && group.countingRefs != 1) {
			throw new Error('Group counted more than once: ' + match);
		}
		return group.counter + '/*' + key + ': ' + group.values.join(', ') + '*/';
	});
	for (var key in groups) {
		var group = groups[key];
		if (!group.countingRefs) {
			console.error("Warning: group " + key + ' is not counted');
		}
	}
	return source;
}

module.exports = function (source) {
	return functionRefs(autoEnums(source));
};