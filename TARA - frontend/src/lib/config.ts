export const config = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "/backend",
  enableBootstrapPage: process.env.NEXT_PUBLIC_ENABLE_BOOTSTRAP_PAGE === "true",
};
