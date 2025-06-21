const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.post('/generate-quiz', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).send('No text provided.');
    }

    const prompt = `
      Based on the following text, create a quiz with 5-7 multiple-choice questions.
      The questions should be designed to test key information from the text.
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

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiText = response.text();

    // --- NEW, MORE ROBUST PARSING LOGIC ---
    console.log("Raw AI Response Text:", aiText); // Log the raw response for debugging

    // Find the first '{' or '[' and the last '}' or ']'
    const firstBracket = aiText.indexOf('[');
    const lastBracket = aiText.lastIndexOf(']');
    const firstBrace = aiText.indexOf('{');
    const lastBrace = aiText.lastIndexOf('}');

    let startIndex = -1;
    let endIndex = -1;

    if (firstBracket !== -1 && lastBracket !== -1) {
        startIndex = firstBracket;
        endIndex = lastBracket;
    } else if (firstBrace !== -1 && lastBrace !== -1) {
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
    // --- END OF NEW LOGIC ---

  } catch (error) {
    console.error("Error in /generate-quiz endpoint:", error); // More specific logging
    res.status(500).send('Failed to generate quiz due to a server error.');
  }
});

app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});