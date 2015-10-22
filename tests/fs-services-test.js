/*global require, process, before, beforeEach, afterEach, describe, it, expect, global*/

var chai = require("chai");
var chaiSubset = require("chai-subset")
var expect = chai.expect; chai.use(chaiSubset);
var lang = require("lively.lang");
var fs = require("fs");
var temp = require("temp").track();
var fs = require("fs");
var path = require("path");
var j = path.join;

var fsServices = require("../lib/fs-services");

describe('fs-services', function() {

  var baseDir, dir1, dir2, dir3, node_modules,
      file1, file2, file3, file4, file5, node_modules_file;
  beforeEach(() => {
    baseDir = temp.mkdirSync("fooo");
    dir1 = j(baseDir, "dir1");
    dir2 = j(dir1, "dir2");
    dir3 = j(baseDir, "dir3");
    node_modules = j(baseDir, "node_modules");
    file1 = j(baseDir, "file1.js");
    file2 = j(dir1, "file2.js");
    file3 = j(dir2, "file3.js");
    file4 = j(dir2, "test.txt");
    file5 = j(dir3, "file5.js");
    node_modules_file = j(node_modules, "file6.js");
    fs.mkdirSync(dir1);
    fs.mkdirSync(dir2);
    fs.mkdirSync(dir3);
    fs.mkdirSync(node_modules);
    fs.writeFileSync(file1, "foo.bar();\n");
    fs.writeFileSync(file2, "bar.baz();\n");
    fs.writeFileSync(file3, "baz.zork();\n");
    fs.writeFileSync(file4, "hello world\n");
    fs.writeFileSync(file5, "/*nothing yet*/\n");
    fs.writeFileSync(node_modules_file, "/*i don't want to be found*/\n");
  });

  it("finds JS files in dir", done => {
    var expected = [file1, file2, file3, file5]
      .map((f) => path.relative(baseDir, f));
    fsServices.findJSFiles(baseDir, (err, files) => {
      expect(files).to
        .have.length(expected.length)
        .include(expected[0])
        .include(expected[1])
        .include(expected[2])
        .include(expected[3])
      done(err);
    });
  });

  it("can find the current directory", done => {
    fsServices.cwd((err, cwd) => {
      expect(process.cwd()).equal(cwd);
      done();
    })
  });

  it("can read file", done => {
    fsServices.readFile(file2, (err, content) => {
      expect(content).to.equal("bar.baz();\n");
      done();
    });
  });

  it("can write files", done => {
    fsServices.writeFile(file2, "foo.uh()", (err) => {
      fsServices.readFile(file2, (err, content) => {
        expect(content).to.equal("foo.uh()");
        done();
      });
    });
  });
});
