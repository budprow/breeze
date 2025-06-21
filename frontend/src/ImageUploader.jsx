import React, { useState } from 'react';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import axios from 'axios';
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';
import './ImageUploader.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfjsWorker;

function preprocessCanvas(canvas) {
  // ... (this helper function is perfect, no changes needed)
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

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
      setOcrText('');
      setProgress(0);
      setQuizData(null);
    }
  };

  const processFile = async () => {
    if (!selectedFile) return;

    setIsLoading(true); // FIX: Set loading true at the very beginning of the process.
    setQuizData(null);  // Clear any previous quiz
    
    try {
      let extractedText = '';
      if (selectedFile.type.startsWith('image/')) {
        extractedText = await processImage(selectedFile);
      } else if (selectedFile.type === 'application/pdf') {
        extractedText = await processPdf(selectedFile);
      } else {
        alert('Unsupported file type.');
        return;
      }
      
      setOcrText(extractedText); // Update the state with the final extracted text

      if (extractedText) {
        await generateQuiz(extractedText);
      }
    } catch (error) {
      console.error("An error occurred during file processing:", error);
      alert("Sorry, something went wrong during processing.");
    } finally {
      setIsLoading(false); // FIX: Set loading false at the very end, no matter what.
    }
  };

  const processImage = async (file) => {
    // FIX: This function now only does one thing: OCR. No more state setting.
    const { data: { text } } = await Tesseract.recognize(file, 'eng', { // FIX: Added await
      logger: (m) => {
        if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100));
      },
    });
    return text;
  };

  const processPdf = async (file) => {
    // FIX: This function now only does one thing: PDF processing. No more state setting.
    const fileReader = new FileReader();
    return new Promise((resolve, reject) => {
      fileReader.onload = async () => {
        try {
          const typedarray = new Uint8Array(fileReader.result);
          const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            setProgress(Math.round((i / pdf.numPages) * 50)); // OCR is the second 50%
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

  const generateQuiz = async (text) => {
    // FIX: This function now only handles the quiz generation API call.
    setProgress(100); // Set progress to 100 as we start the final step
    try {
      const response = await axios.post('http://localhost:3001/generate-quiz', { text });
      setQuizData(response.data);
    } catch (error) {
      console.error("Error fetching quiz data:", error);
      alert("Sorry, there was an error creating the quiz.");
    }
  };

  return (
    <div className="uploader-container">
      {/* ... (The input and button JSX is unchanged) ... */}
      <input type="file" id="fileInput" accept="image/*,application/pdf" onChange={handleFileChange} className="uploader-input" />
      <label htmlFor="fileInput" className="uploader-label">{fileName ? `Selected: ${fileName}` : 'Choose Image or PDF'}</label>
      {selectedFile && (
        <button onClick={processFile} className="process-button" disabled={isLoading}>
          {isLoading ? `Processing... ${progress}%` : 'Generate Quiz'}
        </button>
      )}

      {isLoading && (
        <div className="progress-container">
          <p>This may take a moment...</p>
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}

      {/* FIX: This condition is now safe and checks for quizData */}
      {quizData && !isLoading && (
        <div className="results-container">
          <h3>Quiz is Ready!</h3>
          <p>We've generated a {quizData.length}-question quiz for you.</p>
          {/* We will build the actual game interface in the next step! */}
        </div>
      )}
    </div>
  );
}

export default ImageUploader;