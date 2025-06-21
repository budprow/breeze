import React, { useState } from 'react';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import axios from 'axios';
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';
import './ImageUploader.css';
import Quiz from './Quiz.jsx';

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfjsWorker;

function preprocessCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const contrast = 1.5; 
    let value = (avg - 128) * contrast + 128;
    if (value > 255) value = 255;
    if (value < 0) value = 0;
    data[i] = data[i+1] = data[i+2] = value;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function ImageUploader() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ocrText, setOcrText] = useState('');
  const [fileName, setFileName] = useState('');
  const [quizData, setQuizData] = useState(null);
  const [refinement, setRefinement] = useState('');

  // MODIFIED: This function now resets only the quiz, not the document.
  const handleGenerateNewQuiz = () => {
    setQuizData(null);
    setRefinement('');
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
      setOcrText('');
      setProgress(0);
      setQuizData(null);
      setRefinement('');
    }
  };

  const processFile = async () => {
    if (!selectedFile) return;
    setIsLoading(true);
    setQuizData(null);
    try {
      let extractedText = '';
      if (selectedFile.type.startsWith('image/')) {
        extractedText = await processImage(selectedFile);
      } else if (selectedFile.type === 'application/pdf') {
        extractedText = await processPdf(selectedFile);
      } else {
        alert('Unsupported file type.');
        setIsLoading(false);
        return;
      }
      setOcrText(extractedText);
    } catch (error) {
      console.error("An error occurred during file processing:", error);
      alert("Sorry, something went wrong during processing.");
    } finally {
      setIsLoading(false);
    }
  };

  const processImage = async (file) => {
    const { data: { text } } = await Tesseract.recognize(file, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100));
      },
    });
    return text;
  };

  const processPdf = async (file) => {
    const fileReader = new FileReader();
    return new Promise((resolve, reject) => {
      fileReader.onload = async () => {
        try {
          const typedarray = new Uint8Array(fileReader.result);
          const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            setProgress(Math.round((i / pdf.numPages) * 100));
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            if (textContent.items.length > 0) {
              fullText += textContent.items.map((item) => item.str).join(' ');
            } else {
              const viewport = page.getViewport({ scale: 3 });
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              await page.render({ canvasContext: context, viewport: viewport }).promise;
              const preprocessedCanvas = preprocessCanvas(canvas);
              const { data: { text } } = await Tesseract.recognize(preprocessedCanvas, 'eng');
              fullText += text;
            }
          }
          resolve(fullText);
        } catch (error) {
          reject(error);
        }
      };
      fileReader.onerror = (error) => reject(error);
      fileReader.readAsArrayBuffer(file);
    });
  };

  const generateQuiz = async () => {
    if (!ocrText) {
      alert("No text has been extracted yet!");
      return;
    }
    setIsLoading(true);
    setProgress(0);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await axios.post(`${apiUrl}/generate-quiz`, {  
        text: ocrText, 
        refinementText: refinement 
      });
      setQuizData(response.data);
    } catch (error) {
      console.error("Error fetching quiz data:", error);
      alert("Sorry, there was an error creating the quiz.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="uploader-container">
      {quizData ? (
        // MODIFIED: We pass the new handleGenerateNewQuiz function to the Quiz component
        <Quiz quizData={quizData} onGenerateNew={handleGenerateNewQuiz} />
      ) : (
        <>
          <input type="file" id="fileInput" accept="image/*,application/pdf" onChange={handleFileChange} className="uploader-input" />
          <label htmlFor="fileInput" className="uploader-label">{fileName ? `Selected: ${fileName}` : 'Choose Image or PDF'}</label>
          
          {selectedFile && !ocrText && (
            <button onClick={processFile} className="process-button" disabled={isLoading}>
              {isLoading ? `Extracting... ${progress}%` : '1. Extract Text from File'}
            </button>
          )}

          {ocrText && (
            <>
              <div className="refinement-container">
                <label htmlFor="refinementInput">Optional: Add instructions for the quiz</label>
                <textarea
                  id="refinementInput"
                  className="refinement-input"
                  placeholder='e.g., "focus on ingredients", "ignore prices"'
                  value={refinement}
                  onChange={(e) => setRefinement(e.target.value)}
                />
              </div>
              <button onClick={generateQuiz} className="process-button" disabled={isLoading}>
                {isLoading ? `Generating...` : '2. Generate Quiz'}
              </button>
            </>
          )}

          {isLoading && (
            <div className="progress-container">
              <p>This may take a moment...</p>
              <div className="progress-bar-container">
                <div className="progress-bar" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ImageUploader;