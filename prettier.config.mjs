/** @type {import("prettier").Config} */
const config = {
  printWidth: 100,
  singleQuote: true,
  trailingComma: 'all',
  semi: true,
  proseWrap: 'preserve',
  overrides: [
    { files: ['*.md'], options: { printWidth: 120 } },
    { files: ['*.yml', '*.yaml'], options: { singleQuote: false } },
  ],
};

export default config;
