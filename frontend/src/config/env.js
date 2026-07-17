const requiredVariables = [
  "VITE_APP_NAME",
  "VITE_COMPANY_NAME",
  "VITE_COMPANY_SHORT_NAME",
  "VITE_API_BASE_URL",
  "VITE_DEFAULT_TIMEZONE",
];

requiredVariables.forEach((variableName) => {
  if (!import.meta.env[variableName]) {
    throw new Error(
      `Missing required environment variable: ${variableName}`,
    );
  }
});

export const env = Object.freeze({
  appName: import.meta.env.VITE_APP_NAME,
  companyName: import.meta.env.VITE_COMPANY_NAME,
  companyShortName: import.meta.env.VITE_COMPANY_SHORT_NAME,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  defaultTimezone: import.meta.env.VITE_DEFAULT_TIMEZONE,
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
});