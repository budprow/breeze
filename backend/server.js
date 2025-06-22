const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const parseJsonFromAiResponse = (rawText) => {
  if (rawText.includes('```')) {
    const cleanedText = rawText.substring(rawText.indexOf('\n') + 1, rawText.lastIndexOf('```'));
    return JSON.parse(cleanedText);
  } else {
    return JSON.parse(rawText);
  }
};

app.post('/generate-quiz', async (req, res) => {
  try {
    const { text, refinementText } = req.body;
    if (!text) {
      return res.status(400).send('No text provided.');
    }

    // --- RAG WORKFLOW START ---

    // --- STEP 1: Extract Key Terms (NOW WITH USER GUIDANCE) ---
    console.log("STEP 1: Extracting key terms with user guidance...");

    // MODIFIED: Create a dynamic instruction for the term extractor
    let termFocusInstruction = 'Give a general selection of important terms.';
    if (refinementText) {
      termFocusInstruction = `Your primary focus for selecting terms MUST be guided by the following user instruction: "${refinementText}".`;
    }

    // MODIFIED: Inject the dynamic instruction into the prompt
    const termExtractionPrompt = `
      You are a research assistant. From the following text, extract a list of up to 5 specific, important proper nouns or specialized terms that would be good for looking up in an encyclopedia.
      ${termFocusInstruction}
      Return them ONLY as a valid JSON array of strings inside a json markdown block. For example: \`\`\`json\n["Term 1", "Term 2"]\n\`\`\`.
      
      Text: "${text}"
    `;
    
    const termResult = await model.generateContent(termExtractionPrompt);
    const termResponse = await termResult.response;
    const keyTermsText = termResponse.text();
    console.log("Raw AI Response for terms:", keyTermsText);
    
    const keyTerms = parseJsonFromAiResponse(keyTermsText);
    console.log("Found key terms:", keyTerms);

    // --- STEP 2: Retrieve Knowledge from Wikipedia (No changes here) ---
    console.log("STEP 2: Looking up terms on Wikipedia...");
    let knowledgeBase = '';
    
    const lookupPromises = keyTerms.map(async (term) => {
      try {
        const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=true&explaintext=true&titles=${encodeURIComponent(term)}`;
        const wikiResponse = await axios.get(wikiUrl);
        const pages = wikiResponse.data.query.pages;
        const pageId = Object.keys(pages)[0];
        if (pageId !== "-1" && pages[pageId].extract) {
          return `- ${term}: ${pages[pageId].extract.split('. ').slice(0, 2).join('. ')}.`;
        }
        return null;
      } catch (e) {
        console.error(`Could not fetch Wikipedia article for "${term}"`);
        return null;
      }
    });

    const resolvedKnowledge = await Promise.all(lookupPromises);
    knowledgeBase = resolvedKnowledge.filter(item => item !== null).join('\n');
    console.log("Constructed knowledge base:", knowledgeBase);
    
    // --- STEP 3: Augment the final prompt (No changes here) ---
    console.log("STEP 3: Generating final quiz with augmented prompt...");
    let userInstruction = refinementText ? `IMPORTANT: Follow this special instruction: "${refinementText}".` : '';

    const finalPrompt = `
      You are a helpful quiz creator. Your task is to create a quiz based on the "Primary Document Text" below.
      Use the "Additional Contextual Knowledge" to ask more insightful questions that connect the terms in the document to their real-world meaning.

      **Primary Document Text:**
      ---
      ${text}
      ---

      **Additional Contextual Knowledge:**
      ---
      ${knowledgeBase}
      ---
      
      **Instructions:**
      ${userInstruction}
      Create a quiz with 5 to 7 multiple-choice questions.
      Return the response ONLY as a valid JSON array of objects inside a json markdown block.
      Each object should have the structure: {"question": "...", "options": ["...", "...", "...", "..."], "answer": "..."}
    `;

    // --- STEP 4: Generate the Final Quiz (No changes here) ---
    const finalResult = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
      generationConfig: { temperature: 0.7 },
    });

    const finalResponse = await finalResult.response;
    const aiText = finalResponse.text();
    console.log("Raw AI Response for Quiz:", aiText);

    const quizJson = parseJsonFromAiResponse(aiText);
    res.json(quizJson);

  } catch (error) {
    console.error("Error in /generate-quiz endpoint:", error);
    res.status(500).send('Failed to generate quiz due to a server error.');
  }
});

app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});