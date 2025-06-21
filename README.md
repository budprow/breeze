# Project: DocuGame (Internal Prototype)

## 1. Core Goal

A web application that allows a user to take a picture of a document, from which the app will automatically generate an interactive, Duolingo-style quiz to help with information retention.

---

## 2. Core Loop (MVP v1 - 6 Week Target)

1.  **Input:** User uploads an image file.
2.  **OCR:** The app extracts text from the image on the client-side.
3.  **AI Gen:** The extracted text is sent to a backend API, which forwards it to an LLM to generate quiz questions (MCQ, Fill-in-the-blank).
4.  **Play:** The questions are displayed in a simple interface for the user to answer.
5.  **Score:** The user sees their final score.

---

## 3. "No-Fund" Tech Stack

* **Frontend (Client-Side):** React.js + Tesseract.js for in-browser OCR.
* **Backend (Server-Side):** Node.js with Express (for a simple API endpoint).
* **AI Core:** Google Gemini or OpenAI GPT API.
* **Database:** None for initial prototype.
* **Version Control:** Git & GitHub (Private Repository).

---

## 4. MVP Feature Checklist

- [ ] Basic React App Setup.
- [ ] Image upload functionality.
- [ ] Integrate Tesseract.js to extract text from the uploaded image.
- [ ] Display the extracted text on the screen (to verify OCR is working).
- [ ] Set up a basic Node.js/Express server.
- [ ] Create one API endpoint that accepts text.
- [ ] Connect API to Gemini/OpenAI to generate a quiz from the text.
- [ ] Basic UI to display and answer multiple-choice questions.
- [ ] Score screen.# breeze