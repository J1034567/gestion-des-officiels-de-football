import { GoogleGenAI } from "@google/genai";

if (!process.env.API_KEY) {
  console.warn(
    "API_KEY environment variable not set. AI features will be disabled."
  );
}

// FIX: Initialize the `ai` instance directly with the environment variable as per Gemini API guidelines.
export const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
