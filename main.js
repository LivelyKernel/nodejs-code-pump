var port = process.argv.slice(2)[0] || 9010;
var host = "0.0.0.0";
require(".")(host, port)
