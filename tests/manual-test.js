var p = require("../lib/process.js");

p.runNodeOn("./some-module.js", [], {isWorkspace: true}, function(err, workspace) {
  if (err) console.error(err);
  var code = "1+2";
  console.log("Evaluating %s", code);
  workspace.sendEval(code, (err, result) => {
    console.log("Eval result: ", err ? err : result.value);
    // workspace.stop();
    
    setTimeout(function() {
      
      workspace.fetchModulesAndState((err, state) => {
        console.log(global.eval_rec_some_module_js);
        console.log(require("util").inspect(state, {depth: 5}));
        setTimeout(function() {
        workspace.stop();
          
        }, 600);
      })
    }, 400);
  });
});
