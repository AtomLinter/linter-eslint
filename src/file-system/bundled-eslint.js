
const { normalize, join } = require('path')

// Immutable storage of path to bundled fallback ESLint directory.
//
const bundledEslintPath = normalize(join(__dirname, '..', '..', 'node_modules', 'eslint'))

module.exports = () => bundledEslintPath
