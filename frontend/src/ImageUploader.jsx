import React, { useState } from 'react';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';

// --- FIX Step 1: REMOVE the old import and ADD this new one ---
// This tells Vite to give us the URL of the worker file, which we'll use below.
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';

import './ImageUploader.css';

// --- FIX Step 2: Set the worker source for pdf.js ---
// This line tells pdf.js where to find its worker file.
pdfjsLib.GlobalWorkerOptions.workerSrc = PdfjsWorker;

// NEW HELPER FUNCTION TO IMPROVE IMAGE QUALITY FOR OCR
function preprocessCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    // Convert to grayscale
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    data[i] = avg;     // red
    data[i + 1] = avg; // green
    data[i + 2] = avg; // blue

    // A simple contrast boost - this is a basic example
    const contrast = 1.5; 
    let value = (avg - 128) * contrast + 128;
    if (value > 255) value = 255;
    if (value < 0) value = 0;
    
    data[i] = value;
    data[i+1] = value;
    data[i+2] = value;
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


  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
      setOcrText('');
      setProgress(0);
    }
  };

  const processFile = () => {
    if (!selectedFile) return;

    if (selectedFile.type.startsWith('image/')) {
      processImage(selectedFile);
    } else if (selectedFile.type === 'application/pdf') {
      processPdf(selectedFile);
    } else {
      alert('Unsupported file type. Please select an image or a PDF.');
    }
  };

  const processImage = async (file) => {
    setIsLoading(true);
    setProgress(0);
    const { data: { text } } = await Tesseract.recognize(file, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          setProgress(Math.round(m.progress * 100));
        }
      },
    });
    setOcrText(text);
    setIsLoading(false);
  };

  const processPdf = async (file) => {
    setIsLoading(true);
    const fileReader = new FileReader();

    fileReader.onload = async () => {
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
          // viewport "scale" between 2-5, renders a higher res, slowier process
          const viewport = page.getViewport({ scale: 3 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({ canvasContext: context, viewport: viewport }).promise;
          // PRE-PROCESS THE CANVAS
          const preprocessedCanvas = preprocessCanvas(canvas);
          const { data: { text } } = await Tesseract.recognize(canvas, 'eng');
          fullText += text;
        }
      }
      setOcrText(fullText);
      setIsLoading(false);
    };
    fileReader.readAsArrayBuffer(file);
  };


  return (
    <div className="uploader-container">
      <input
        type="file"
        id="fileInput"
        accept="image/*,application/pdf"
        onChange={handleFileChange}
        className="uploader-input"
      />

      <label htmlFor="fileInput" className="uploader-label">
        {fileName ? `Selected: ${fileName}` : 'Choose Image or PDF'}
      </label>

      {selectedFile && (
        <button
          onClick={processFile}
          className="process-button"
          disabled={isLoading}
        >
          {isLoading ? `Processing... ${progress}%` : 'Extract Text'}
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

      {ocrText && !isLoading && (
        <div className="results-container">
          <h3>Extracted Text:</h3>
          <textarea readOnly value={ocrText}></textarea>
        </div>
      )}
    </div>
  );
}

export default ImageUploader;