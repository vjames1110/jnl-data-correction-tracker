const requiredEnvironmentVariables = [
  "VITE_APP_NAME",
  "VITE_COMPANY_NAME",
  "VITE_API_BASE_URL",
];

requiredEnvironmentVariables.forEach((variableName) => {
  if (!import.meta.env[variableName]) {
    throw new Error(
      `Missing required environment variable: ${variableName}`,
    );
  }
});

export const env = Object.freeze({
  appName: import.meta.env.VITE_APP_NAME,
  companyName: import.meta.env.VITE_COMPANY_NAME,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
});