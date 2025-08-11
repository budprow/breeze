import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// --- FIX #1: Directly import the TextLayer class from its specific module ---
import { TextLayer } from 'pdfjs-dist/web/pdf_viewer.mjs';
import 'pdfjs-dist/web/pdf_viewer.css';
import './PdfViewer.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

function PdfViewer({ pdf, pageNumber, onPageRendered, keySentences, onIconClick }) {
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const renderTask = useRef(null); // Use a ref to prevent re-renders from affecting the task

  // Use useCallback to prevent the function from being recreated on every render
  const stableOnIconClick = useCallback(onIconClick, [onIconClick]);

  useEffect(() => {
    if (!pdf) return;

    // Cancel any previous render task to avoid race conditions
    if (renderTask.current) {
      renderTask.current.cancel();
    }

    const renderPage = async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.5 });
        
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const textLayerDiv = textLayerRef.current;
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;

        // Render the visual PDF page
        renderTask.current = page.render({ canvasContext: context, viewport: viewport });
        await renderTask.current.promise;

        // Get text content for the selectable layer
        const textContent = await page.getTextContent();
        textLayerDiv.innerHTML = ''; // Clear previous layer

        // --- FIX #2: Create a NEW instance of the imported TextLayer class ---
        const textLayer = new TextLayer({
          textContentSource: textContent,
          container: textLayerDiv,
          viewport: viewport,
        });

        // Render the text layer. Note: .render() is synchronous and doesn't return a promise.
        textLayer.render();
        
        // --- Logic to find sentences and add icons ---
        if (keySentences && keySentences.length > 0 && textLayerRef.current) {
          const textLayerSpans = Array.from(textLayerDiv.querySelectorAll('span'));
          const fullPageText = textLayerSpans.map(span => span.textContent).join('');

          keySentences.forEach(sentence => {
            const normalizedSentence = sentence.trim();
            const sentenceIndex = fullPageText.indexOf(normalizedSentence);

            if (sentenceIndex !== -1) {
              let charCount = 0;
              let firstSpan = null;

              for (const span of textLayerSpans) {
                const spanTextLength = span.textContent.length;
                if (charCount + spanTextLength > sentenceIndex && firstSpan === null) {
                  firstSpan = span;
                  break;
                }
                charCount += spanTextLength;
              }

              if (firstSpan) {
                const icon = document.createElement('span');
                icon.textContent = '✨';
                icon.className = 'key-concept-icon';
                icon.style.left = `${parseFloat(firstSpan.style.left) - 20}px`; // Position to the left
                icon.style.top = firstSpan.style.top;
                icon.onclick = () => stableOnIconClick(sentence);
                textLayerDiv.appendChild(icon);
              }
            }
          });
        }

        onPageRendered(textContent.items.map(item => item.str).join(' '));
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.error("Error rendering page:", err);
        }
      }
    };

    renderPage();

  }, [pdf, pageNumber, onPageRendered, keySentences, stableOnIconClick]);

  return (
    <div className="pdf-viewer-container">
      <canvas ref={canvasRef} className="pdf-canvas"></canvas>
      <div ref={textLayerRef} className="textLayer"></div>
    </div>
  );
}

export default PdfViewer;