import React, { useState } from 'react';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import api from './api'; // <-- Import your centralized API config
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';
import QuizFlow from './QuizFlow';
import './ImageUploader.css';

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
        data[i] = data[i + 1] = data[i + 2] = value;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

function ImageUploader({ onQuizGeneratedForUser }) {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [ocrText, setOcrText] = useState('');
    const [activeQuiz, setActiveQuiz] = useState(null);

    const handleFileChange = (event) => {
        const files = Array.from(event.target.files);
        if (files.length > 0) {
            setSelectedFiles(files);
            setOcrText('');
            setProgress(0);
            setActiveQuiz(null);
        }
    };

    const handleExtractText = async () => {
        if (selectedFiles.length === 0) return;
        setIsLoading(true);
        let combinedText = '';
        try {
            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                let extractedText = '';
                if (file.type.startsWith('image/')) {
                    extractedText = await processImage(file);
                } else if (file.type === 'application/pdf') {
                    extractedText = await processPdf(file);
                }
                combinedText += extractedText + '\n\n';
            }
            setOcrText(combinedText);
        } catch (error) {
            alert("Sorry, something went wrong during text extraction.");
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

    const handleGenerateQuiz = async () => {
        if (!ocrText) return;
        setIsLoading(true);
        try {
            // --- THIS IS THE FIX ---
            // Use the centralized 'api' object which knows about the emulators
            const response = await api.post('/generate-quiz', { text: ocrText });

            if (onQuizGeneratedForUser) {
                // If this is for a logged-in user, pass the data to the dashboard
                onQuizGeneratedForUser({
                    quizData: response.data,
                    sourceText: ocrText
                });
            } else {
                // If this is for a guest/demo, start the local flow
                setActiveQuiz({
                    quizData: response.data,
                    sourceText: ocrText
                });
            }

        } catch (error) {
            alert("Sorry, there was an error creating the quiz.");
        } finally {
            setIsLoading(false);
        }
    };

    if (activeQuiz) {
        return (
            <QuizFlow
                initialQuizData={activeQuiz.quizData}
                sourceText={activeQuiz.sourceText}
                onFlowComplete={() => setActiveQuiz(null)}
                isGuest={true}
            />
        );
    }

    return (
        <div className="uploader-container">
            <div className="explanation-box">
                <h2>Your Personal Study Sidekick</h2>
                <p>Upload documents or take photos. We'll turn them into an interactive quiz to help you learn faster.</p>
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
                    Select Documents or Take Photo(s)
                </label>

                {selectedFiles.length > 0 && (
                    <div className="file-list-container">
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
                        {isLoading ? `Reading... ${progress}%` : 'Extract Text from Documents'}
                    </button>
                </div>
            )}

            {ocrText && (
                <div className="upload-step">
                    <h3>Step 3: Generate Your Quiz</h3>
                    <button onClick={handleGenerateQuiz} className="process-button" disabled={isLoading}>
                        {isLoading ? 'Generating Quiz...' : 'Generate Quiz Now'}
                    </button>
                </div>
            )}
        </div>
    );
}

export default ImageUploader;