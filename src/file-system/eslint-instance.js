'use babel'

const getEslintInstance = (eslintDir) => {
  try {
    // eslint-disable-next-line import/no-dynamic-require
    return require(eslintDir)
  } catch (e) {
    throw new Error('ESLint not found, try restarting Atom to clear caches.')
  }
}

export default getEslintInstance
