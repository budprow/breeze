import React, { useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';
import './PdfViewer.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// This component now receives the loaded pdf and the page number to display
function PdfViewer({ pdf, pageNumber, onPageRendered }) {
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const renderTask = useRef(null);

  useEffect(() => {
    if (!pdf) return;

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

        renderTask.current = page.render({
          canvasContext: context,
          viewport: viewport,
        });
        await renderTask.current.promise;

        const textContent = await page.getTextContent();
        textLayerDiv.innerHTML = '';

        const textLayer = new pdfjsLib.TextLayer({
          textContentSource: textContent,
          container: textLayerDiv,
          viewport: viewport,
        });
        await textLayer.render();

        // Send the extracted text back up to the parent
        onPageRendered(textContent.items.map(item => item.str).join(' '));

      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.error("Error rendering page:", err);
          // You can also pass the error state up if you want
        }
      }
    };

    renderPage();

  }, [pdf, pageNumber, onPageRendered]);

  return (
    <div className="pdf-viewer-container">
      <canvas ref={canvasRef} className="pdf-canvas"></canvas>
      <div ref={textLayerRef} className="textLayer"></div>
    </div>
  );
}

export default PdfViewer;