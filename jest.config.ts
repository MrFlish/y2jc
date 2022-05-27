/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testPathIgnorePatterns: ["/dist/"],
  collectCoverage: true,
  roots: ["./src/"]
};