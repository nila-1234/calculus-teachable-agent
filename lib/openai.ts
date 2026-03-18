import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.LITELLM_PROXY_KEY,
  baseURL: process.env.LITELLM_PROXY_URL,
});

console.log("API KEY LOADED:", process.env.LITELLM_PROXY_KEY?.slice(0, 10));

export default client;