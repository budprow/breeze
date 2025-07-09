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
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [groupName, setGroupName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [ocrText, setOcrText] = useState('');
    const [quizData, setQuizData] = useState(null);
    const [refinement, setRefinement] = useState('');

    const handleFileChange = (event) => {
        const files = Array.from(event.target.files);
        if (files.length > 0) {
            setSelectedFiles(files);
            setOcrText('');
            setProgress(0);
            setQuizData(null);
            setRefinement('');
        }
    };

    const handleExtractText = async () => {
        if (selectedFiles.length === 0) return;
        setIsLoading(true);
        setQuizData(null);
        let combinedText = '';

        try {
            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                let extractedText = '';
                setProgress(Math.round(((i + 1) / selectedFiles.length) * 50)); // Progress up to 50%
                
                if (file.type.startsWith('image/')) {
                    extractedText = await processImage(file);
                } else if (file.type === 'application/pdf') {
                    extractedText = await processPdf(file);
                }
                combinedText += extractedText + '\n\n';
            }
            setOcrText(combinedText);
            setProgress(100);
        } catch (error) {
            console.error("An error occurred during file processing:", error);
            alert("Sorry, something went wrong during processing.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const processImage = async (file) => {
        const { data: { text } } = await Tesseract.recognize(file, 'eng');
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
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        fullText += textContent.items.map((item) => item.str).join(' ');
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
            alert("Please extract text from your documents first!");
            return;
        }
        setIsLoading(true);
        setProgress(0);
        try {
            const apiUrl = "https://us-central1-breeze-9c703.cloudfunctions.net/api";
            const response = await axios.post(`${apiUrl}/generate-quiz`, {
                text: ocrText,
                refinementText: refinement,
            });
            setQuizData(response.data.questions);
        } catch (error) {
            console.error("Error fetching quiz data:", error);
            alert("Sorry, there was an error creating the quiz.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleGenerateNewQuiz = () => {
        setQuizData(null);
        setRefinement('');
    };
    
    if (quizData) {
        return <Quiz quizData={quizData} onGenerateNew={handleGenerateNewQuiz} />;
    }

    const fileInputLabel = selectedFiles.length > 0 
        ? `${selectedFiles.length} file(s) selected. Change?` 
        : 'Select Documents or Take Photo(s)';

    return (
        <div className="uploader-container">
            <div className="explanation-box">
                <h2>Your Personal Study Sidekick</h2>
                <p>Turn any document, textbook page, or lecture note into an interactive quiz. Use the instructions box to guide the AI, helping you focus on what's most important.</p>
            </div>

            <div className="upload-step">
                <h3>Step 1: Upload Your Materials</h3>
                <input
                    type="file"
                    id="fileInput"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    className="uploader-input"
                />
                <label htmlFor="fileInput" className="uploader-label">
                    {fileInputLabel}
                </label>

                {selectedFiles.length > 0 && (
                    <div className="file-list-container">
                        <input
                            type="text"
                            className="group-name-input"
                            placeholder="Name this study set (e.g., 'Chapter 5 Notes')"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                        />
                        <ul>
                            {selectedFiles.map((file, index) => (
                                <li key={index}>{file.name}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
            
            {selectedFiles.length > 0 && !ocrText && (
                <div className="upload-step">
                    <h3>Step 2: Extract Text</h3>
                    <button onClick={handleExtractText} className="process-button" disabled={isLoading}>
                        {isLoading ? `Reading... ${progress}%` : 'Extract Text from Document(s)'}
                    </button>
                </div>
            )}
            
            {ocrText && (
                 <div className="upload-step">
                    <h3>Step 3: Generate Your Quiz</h3>
                    <div className="refinement-container">
                        <label htmlFor="refinementInput">Optional: Give the AI special instructions</label>
                        <textarea
                            id="refinementInput"
                            className="refinement-input"
                            placeholder='e.g., "focus on dates and names", "ignore the summary section"'
                            value={refinement}
                            onChange={(e) => setRefinement(e.target.value)}
                        />
                    </div>
                    <button onClick={generateQuiz} className="process-button" disabled={isLoading}>
                        {isLoading ? 'Generating Quiz...' : 'Generate Quiz Now'}
                    </button>
                </div>
            )}
        </div>
    );
}

export default ImageUploader;