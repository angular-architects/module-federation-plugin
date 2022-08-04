const { getJestProjects } = require('@nrwl/jest');

export default {
  projects: [
    ...getJestProjects(),
    '<rootDir>/libs/mf',
    '<rootDir>/libs/mf-runtime',
    '<rootDir>/libs/mf-tools',
    '<rootDir>/apps/playground',
  ],
};
