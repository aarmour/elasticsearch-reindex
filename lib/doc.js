var fs = require('fs');

module.exports = function(doc) {
  var text = '';
  
  try { text = fs.readFileSync(__dirname + '/../doc/' + doc + '.txt', 'utf8'); } catch(e) {}

  return text;
};