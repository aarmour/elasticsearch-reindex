var util = require('util');

exports = module.exports = {};

for (var property in util) {
  if (util.hasOwnProperty(property)) {
    exports[property] = util[property]; 
  }
}

exports.extend = function(obj) {
  Array.prototype.slice.call(arguments, 1).forEach(function(source) {
    if (source) {
      for (var prop in source) {
        obj[prop] = source[prop];
      }
    }
  });

  return obj;
};