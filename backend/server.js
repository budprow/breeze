const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = 3001;

// Middleware to allow cross-origin requests and parse JSON bodies
app.use(cors());
app.use(express.json());

// Initialize the Google AI Client with the API key from the .env file
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Define the single API endpoint for generating quizzes
app.post('/generate-quiz', async (req, res) => {
  try {
    // Expect both 'text' and 'refinementText' from the frontend
    const { text, refinementText } = req.body;

    if (!text) {
      return res.status(400).send('No text provided.');
    }

    // Dynamically create an instruction string if refinementText exists
    let userInstruction = '';
    if (refinementText) {
      userInstruction = `
        IMPORTANT: You must follow this special instruction when creating the questions: "${refinementText}".
      `;
    }

    // Construct the full prompt to send to the AI
    const prompt = `
      Based on the following text, create a quiz with 5 to 7 multiple-choice questions.
      The questions should be designed to test key information from the text.
      ${userInstruction}
      Return the response ONLY as a valid JSON array of objects.
      Do not include any other text or explanations before or after the JSON array.
      Each object in the array should have the following structure:
      {
        "question": "The question text",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "answer": "The correct option text"
      }

      Here is the text:
      ---
      ${text}
      ---
    `;

    // Call the AI model with the prompt and the temperature setting
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8, // Higher value (e.g., 0.8) means more creative, less repetitive
      },
    });
    
    const response = await result.response;
    const aiText = response.text();

    console.log("Raw AI Response Text:", aiText); // Log for debugging

    // Robustly find and parse the JSON from the AI's potentially messy response
    const firstBracket = aiText.indexOf('[');
    const lastBracket = aiText.lastIndexOf(']');
    const firstBrace = aiText.indexOf('{');
    const lastBrace = aiText.lastIndexOf('}');

    let startIndex = -1;
    let endIndex = -1;

    // Prioritize parsing an array of objects
    if (firstBracket !== -1 && lastBracket !== -1) {
        startIndex = firstBracket;
        endIndex = lastBracket;
    } 
    // Fallback to parsing a single object if no array is found
    else if (firstBrace !== -1 && lastBrace !== -1) {
        startIndex = firstBrace;
        endIndex = lastBrace;
    }

    if (startIndex !== -1 && endIndex !== -1) {
        const jsonString = aiText.substring(startIndex, endIndex + 1);
        const quizJson = JSON.parse(jsonString);
        res.json(quizJson);
    } else {
        throw new Error("Could not find valid JSON in the AI response.");
    }

  } catch (error) {
    console.error("Error in /generate-quiz endpoint:", error);
    res.status(500).send('Failed to generate quiz due to a server error.');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});