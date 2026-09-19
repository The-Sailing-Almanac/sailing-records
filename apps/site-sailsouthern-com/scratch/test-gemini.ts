import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function main() {
  console.log("Using API Key:", process.env.GEMINI_API_KEY?.substring(0, 10) + "...");
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();
    console.log("Available models:", data);
  } catch (err) {
    console.error("Fetch models failed:", err);
  }
}

main();
