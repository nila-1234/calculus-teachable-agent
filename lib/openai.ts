import OpenAI from "openai";

const client = new OpenAI({
  // Keep route modules buildable without local credentials. Requests still
  // fail at runtime until the real LiteLLM environment is configured.
  apiKey: process.env.LITELLM_PROXY_KEY ?? "litellm-not-configured",
  baseURL: process.env.LITELLM_PROXY_URL ?? "http://127.0.0.1:1",
});

// console.log("API KEY LOADED:", process.env.LITELLM_PROXY_KEY?.slice(0, 10));

export default client;