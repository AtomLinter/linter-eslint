module.exports = {
  env: {
    jasmine: true,
    atomtest: true
  },
  rules: {
    'import/no-extraneous-dependencies': ['error', {devDependencies: true}]
  }
}
