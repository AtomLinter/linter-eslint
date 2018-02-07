'use babel'

import { normalize, join } from 'path'

// Immutable storage of path to bundled fallback ESLint directory.
//
const bundledEslintPath = normalize(join(__dirname, '..', '..', 'node_modules', 'eslint'))

export default () => bundledEslintPath
