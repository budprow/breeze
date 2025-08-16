import React, { useEffect, useRef, useCallback, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.mjs';
import 'pdfjs-dist/web/pdf_viewer.css';
import './PdfViewer.css';
import './ActiveReader.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

function PdfViewer({ pdf, pageNumber, onPageRendered, keySentences, onIconClick, onSaveHighlight, highlights }) {
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const renderTask = useRef(null);
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, text: '' });

  const stableOnIconClick = useCallback(onIconClick, [onIconClick]);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = textLayerRef.current.getBoundingClientRect();
      
      setTooltip({
        show: true,
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top - 35, // Position above selection
        text: selectedText,
      });
    } else {
      setTooltip({ show: false, x: 0, y: 0, text: '' });
    }
  };

  const handleSaveHighlight = () => {
    onSaveHighlight(tooltip.text);
    setTooltip({ show: false, x: 0, y: 0, text: '' });
  };

  useEffect(() => {
    if (!pdf) {
      return;
    }

    let isCancelled = false;

    const renderPage = async () => {
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
        textLayerDiv.innerHTML = '';

        // Ensure text layer positioning matches canvas
        textLayerDiv.style.position = 'absolute';
        textLayerDiv.style.left = '0px';
        textLayerDiv.style.top = '0px';
        textLayerDiv.style.zIndex = '2';
        textLayerDiv.style.userSelect = 'text';
        textLayerDiv.style.pointerEvents = 'auto';

        renderTask.current = page.render({ canvasContext: context, viewport: viewport });
        await renderTask.current.promise;
        if (isCancelled) return;

        const textContent = await page.getTextContent();
        if (isCancelled) return;

        const textLayer = new pdfjsLib.TextLayer({
          textContentSource: textContent,
          container: textLayerDiv,
          viewport: viewport,
          isOffscreenCanvasSupported: false, // Ensure compatibility
        });

        await textLayer.render();
        
        // Apply highlights and key sentences after text layer is rendered
        if (highlights && highlights.length > 0) {
            const textLayerSpans = Array.from(textLayerDiv.querySelectorAll('span[role="presentation"]'));
            const normalize = (str) => str.replace(/\s+/g, ' ').trim();
            const pageTextContent = normalize(textLayerSpans.map(span => span.textContent).join(''));

            highlights.forEach(highlight => {
                const normalizedHighlight = normalize(highlight.text);
                let startIndex = pageTextContent.indexOf(normalizedHighlight);
                if (startIndex === -1) return;

                let endIndex = startIndex + normalizedHighlight.length;
                let charCount = 0;
                let startSpan = null;
                let endSpan = null;

                for(let i = 0; i < textLayerSpans.length; i++){
                    const spanText = normalize(textLayerSpans[i].textContent);
                    if(charCount >= startIndex && startSpan === null){
                        startSpan = textLayerSpans[i];
                    }
                    if(charCount + spanText.length >= endIndex && endSpan === null){
                        endSpan = textLayerSpans[i];
                    }
                    if(startSpan && endSpan) break;
                    charCount += spanText.length;
                }

                if(startSpan && endSpan){
                    const range = document.createRange();
                    range.setStart(startSpan.firstChild, (startIndex - pageTextContent.indexOf(normalize(startSpan.textContent))));
                    range.setEnd(endSpan.firstChild, (endIndex - pageTextContent.indexOf(normalize(endSpan.textContent))));
                    const highlightSpan = document.createElement('span');
                    highlightSpan.className = 'highlighted';
                    highlightSpan.appendChild(range.extractContents());
                    range.insertNode(highlightSpan);
                }
            });
        }

        if (keySentences && keySentences.length > 0) {
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
  }, [pdf, pageNumber, onPageRendered, keySentences, stableOnIconClick, highlights]);

  return (
    <div className="pdf-viewer-container">
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <canvas ref={canvasRef} className="pdf-canvas"></canvas>
        <div 
          ref={textLayerRef} 
          className="textLayer" 
          onMouseUp={handleMouseUp}
          style={{ 
            position: 'absolute', 
            left: 0, 
            top: 0, 
            width: '100%', 
            height: '100%',
            zIndex: 2,
            userSelect: 'text',
            pointerEvents: 'auto'
          }}
        ></div>
      </div>
      {tooltip.show && (
        <div className="highlight-tooltip" style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}>
          <button onClick={handleSaveHighlight}>Save Highlight</button>
        </div>
      )}
    </div>
  );
}

export default PdfViewer;
