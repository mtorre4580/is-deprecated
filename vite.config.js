/* eslint-disable import/no-extraneous-dependencies */
const path = require('path');
const { defineConfig } = require('vite');

module.exports = defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'lib/main.js'),
      name: 'is-deprecated"',
      fileName: (format) => `is-deprecated.${format}.js`,
    },
  },
});
