import dotenv from "dotenv";
dotenv.config();

// Validate that GOOGLE_API_KEY is set before anything imports the model
if (!process.env["GOOGLE_API_KEY"]) {
  throw new Error(
    "Missing GOOGLE_API_KEY environment variable. " +
      "Add it to your .env file: GOOGLE_API_KEY=your-key-here"
  );
}

export const GEMINI_API_KEY = process.env["GOOGLE_API_KEY"];
