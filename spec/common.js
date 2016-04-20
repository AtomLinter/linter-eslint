const Path = require('path')

module.exports.getFixturesPath = function (path) {
  return Path.join(__dirname, 'fixtures', path)
}
