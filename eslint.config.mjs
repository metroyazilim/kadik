import nextConfig from "eslint-config-next";

const eslintConfig = [
  { ignores: ["test-results/**", "playwright-report/**", "_bmad-output/test-artifacts/playwright-report/**"] },
  ...nextConfig,
];

export default eslintConfig;
