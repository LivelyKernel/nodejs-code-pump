/*global require, __dirname*/

var lang = require("lively.lang");
var util = require('util');
var fs = require('fs');
var path = require('path');

// helper
function signatureOf(name, func) {
    var source = String(func),
        match = source.match(/function\s*[a-zA-Z0-9_$]*\s*\(([^\)]*)\)/),
        params = (match && match[1]) || '';
    return name + '(' + params + ')';
}

function isClass(obj) {
    if (obj === obj
      || obj === Array
      || obj === Function
      || obj === String
      || obj === Boolean
      || obj === Date
      || obj === RegExp
      || obj === Number) return true;
    return (obj instanceof Function)
        && ((obj.superclass !== undefined)
         || (obj._superclass !== undefined));
}

function pluck(list, prop) { return list.map(function(ea) { return ea[prop]; }); }

function getObjectForCompletion(evalFunc, stringToEval, thenDo) {
    // thenDo = function(err, obj, startLetters)
    var idx = stringToEval.lastIndexOf('.'),
        startLetters = '';
    if (idx >= 0) {
        startLetters = stringToEval.slice(idx+1);
        stringToEval = stringToEval.slice(0,idx);
    }
    var completions = [];
    try {
        var obj = evalFunc(stringToEval);
    } catch (e) {
        thenDo(e, null, null);
    }
    thenDo(null, obj, startLetters);
}

function propertyExtract(excludes, obj, extractor) {
    // show(''+excludes)
    return Object.getOwnPropertyNames(obj)
        .filter(function(key) { return excludes.indexOf(key) === -1; })
        .map(extractor)
        .filter(function(ea) { return !!ea; })
        .sort(function(a,b) {
            return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0); });
}

function getMethodsOf(excludes, obj) {
    return propertyExtract(excludes, obj, function(key) {
        if (obj.__lookupGetter__(key) || typeof obj[key] !== 'function') return null;
        return {name: key, completion: signatureOf(key, obj[key])}; })
}

function getAttributesOf(excludes, obj) {
    return propertyExtract(excludes, obj, function(key) {
        if (!obj.__lookupGetter__(key) && typeof obj[key] === 'function') return null;
        return {name: key, completion: key}; })
}

function getProtoChain(obj) {
    var protos = [], proto = obj;
    while (obj) { protos.push(obj); obj = obj.__proto__ }
    return protos;
}

function getDescriptorOf(originalObj, proto) {
    function shorten(s, len) {
        if (s.length > len) s = s.slice(0,len) + '...';
        return s.replace(/\n/g, '').replace(/\s+/g, ' ');
    }

    if (originalObj === proto) {
        if (typeof originalObj !== 'function') return shorten(originalObj.toString(), 50);
        var funcString = originalObj.toString(),
            body = shorten(funcString.slice(funcString.indexOf('{')+1, funcString.lastIndexOf('}')), 50);
        return signatureOf(originalObj.displayName || originalObj.name || 'function', originalObj) + ' {' + body + '}';
    }

    var klass = proto.hasOwnProperty('constructor') && proto.constructor;
    if (!klass) return 'prototype';
    if (typeof klass.type === 'string' && klass.type.length) return shorten(klass.type, 50);
    if (typeof klass.name === 'string' && klass.name.length) return shorten(klass.name, 50);
    return "anonymous class";
}

function getCompletions(evalFunc, string, thenDo) {
    // thendo = function(err, completions/*ARRAY*/)
    // eval string and for the resulting object find attributes and methods,
    // grouped by its prototype / class chain
    // if string is something like "foo().bar.baz" then treat "baz" as start
    // letters = filter for properties of foo().bar
    // ("foo().bar.baz." for props of the result of the complete string)
    getObjectForCompletion(evalFunc, string, function(err, obj, startLetters) {
        if (err) { thenDo(err); return }
        var excludes = [];
        var completions = getProtoChain(obj).map(function(proto) {
            var descr = getDescriptorOf(obj, proto),
                methodsAndAttributes = getMethodsOf(excludes, proto)
                    .concat(getAttributesOf(excludes, proto));
            excludes = excludes.concat(pluck(methodsAndAttributes, 'name'));
            return [descr, pluck(methodsAndAttributes, 'completion')];
        });
        thenDo(err, completions, startLetters);
    })
}

/*
(function testCompletion() {
    function assertCompletions(err, completions, prefix) {
        assert(!err, 'getCompletions error: ' + err);
        assert(prefix === '', 'prefix: ' + prefix);
        assert(completions.length === 3, 'completions does not contain 3 groups ' + completions.length)
        assert(completions[2][0] === 'Object', 'last completion group is Object')
        objectCompletions = completions.slice(0,2)
        expected = [["[object Object]", ["m1(a)","m2(x)","a"]],
                    ["prototype", ["m3(a,b,c)"]]]
        assert(Objects.equals(expected, objectCompletions), 'compl not equal');
        alertOK('all good!')
        
    }
    function evalFunc(string) { return eval(string); }
    var code = "obj1 = {m2: function() {}, m3:function(a,b,c) {}}\n"
             + "obj2 = {a: 3, m1: function(a) {}, m2:function(x) {}, __proto__: obj1}\n"
             + "obj2."
    getCompletions(evalFunc, code, assertCompletions)
})();
*/
// end of completion code
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// exports
module.exports = {
  getCompletions: getCompletions
}
