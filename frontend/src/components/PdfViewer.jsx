import React, { useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// --- FIX #1: Import the viewer module for its side-effects ---
// This will attach the necessary components, like TextLayer, to the pdfjsLib object.
import 'pdfjs-dist/web/pdf_viewer.mjs';
import 'pdfjs-dist/web/pdf_viewer.css';
import './PdfViewer.css';

// Set the workerSrc for pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

function PdfViewer({ pdf, pageNumber, onPageRendered, keySentences, onIconClick }) {
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const renderTask = useRef(null);

  const stableOnIconClick = useCallback(onIconClick, [onIconClick]);

  useEffect(() => {
    if (!pdf) {
      return;
    }

    let isCancelled = false;

    const renderPage = async () => {
      // Ensure any previous render task is cancelled before starting a new one.
      if (renderTask.current) {
        renderTask.current.cancel();
      }

      try {
        const page = await pdf.getPage(pageNumber);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale: 1.5 });
        
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const textLayerDiv = textLayerRef.current;
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;
        textLayerDiv.innerHTML = ''; // Clear previous content

        // Start the rendering of the page onto the canvas
        renderTask.current = page.render({ canvasContext: context, viewport: viewport });
        await renderTask.current.promise;
        if (isCancelled) return;

        const textContent = await page.getTextContent();
        if (isCancelled) return;

        // --- FIX #2: Access TextLayer from the main pdfjsLib object ---
        const textLayer = new pdfjsLib.TextLayer({
          textContentSource: textContent,
          container: textLayerDiv,
          viewport: viewport,
        });

        // The .render() method on the instance is synchronous.
        textLayer.render();
        
        // --- Logic to find sentences and add icons ---
        if (keySentences && keySentences.length > 0 && textLayerRef.current) {
          const textLayerSpans = Array.from(textLayerDiv.querySelectorAll('span[role="presentation"]'));
          const normalize = (str) => str.replace(/\s+/g, ' ').trim();
          const pageTextContent = normalize(textLayerSpans.map(span => span.textContent).join(' '));

          keySentences.forEach(sentence => {
            const normalizedSentence = normalize(sentence);
            const sentenceIndex = pageTextContent.indexOf(normalizedSentence);

            if (sentenceIndex !== -1) {
              let charCount = 0;
              let firstSpan = null;

              for (const span of textLayerSpans) {
                const normalizedSpanText = normalize(span.textContent);
                if (charCount + normalizedSpanText.length > sentenceIndex) {
                  firstSpan = span;
                  break;
                }
                charCount += normalizedSpanText.length + 1;
              }

              if (firstSpan) {
                const icon = document.createElement('span');
                icon.textContent = '✨';
                icon.className = 'key-concept-icon';
                icon.style.left = `${parseFloat(firstSpan.style.left) - 20}px`;
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

    return () => {
      isCancelled = true;
      if (renderTask.current) {
        renderTask.current.cancel();
      }
    };
  }, [pdf, pageNumber, onPageRendered, keySentences, stableOnIconClick]);

  return (
    <div className="pdf-viewer-container">
      <canvas ref={canvasRef} className="pdf-canvas"></canvas>
      <div ref={textLayerRef} className="textLayer"></div>
    </div>
  );
}

export default PdfViewer;
