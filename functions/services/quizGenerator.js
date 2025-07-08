// This helper function now lives with the quiz logic
const parseJsonFromAiResponse = (rawText) => {
  const match = rawText.match(/```json\n([\s\S]*?)\n```/);
  if (!match || !match[1]) {
    console.error("Could not find a JSON code block in the AI response.");
    return null;
  }
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    console.error("Failed to parse JSON from the AI response:", error);
    return null;
  }
};

// This function is dedicated to making multiple choice quizzes
const generateMultipleChoice = async (genAI, text, refinementText) => {
  const model = genAI.getGenerativeModel({model: "gemini-1.5-flash"});
  const prompt = `
      Based on the following text, generate a multiple-choice quiz with 5 to 8 questions.
      Each question must have exactly 4 answer options, with only one being correct.
      ${refinementText ? `Follow these specific instructions: "${refinementText}".` : ""}
      Format the output as a single JSON object inside a \`\`\`json code block.
      The JSON object should have a single key "questions", which is an array.
      Each object in the "questions" array should have:
      - a "question" key with the question text (string).
      - an "options" key with an array of 4 answer strings.
      - a "correctAnswer" key with the string of the correct answer, which must exactly match one of the strings in the "options" array.
      Here is the text to analyze:
      ---
      ${text}
      ---
    `;

  const result = await model.generateContent(prompt);
  return parseJsonFromAiResponse(result.response.text());
};


// This line makes the function(s) available to be imported in other files
module.exports = {
  generateMultipleChoice,
  // When you add generateTrueFalse, etc., you will export them here too.
};
