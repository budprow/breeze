import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import * as pdfjsViewer from 'pdfjs-dist/web/pdf_viewer.mjs';
import 'pdfjs-dist/web/pdf_viewer.css';
import './PdfViewer.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

function PdfViewer({ fileUrl, onPageChange, onDocumentLoad }) {
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [renderTask, setRenderTask] = useState(null);

  useEffect(() => {
    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument(fileUrl);
        const loadedPdf = await loadingTask.promise;
        setPdf(loadedPdf);
        setTotalPages(loadedPdf.numPages);
        onDocumentLoad(loadedPdf.numPages);
      } catch (err) {
        console.error("Error loading PDF:", err);
        setError("Could not load the PDF. It may be corrupted or inaccessible.");
      }
    };
    if (fileUrl) {
      loadPdf();
    }
  }, [fileUrl, onDocumentLoad]);

  useEffect(() => {
    if (!pdf) return;

    if (renderTask) {
      renderTask.cancel();
    }

    const renderPage = async () => {
      setIsLoading(true);
      try {
        const page = await pdf.getPage(currentPage);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const textLayerDiv = textLayerRef.current;
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;

        const newRenderTask = page.render({
          canvasContext: context,
          viewport: viewport,
        });
        
        setRenderTask(newRenderTask);
        await newRenderTask.promise;
        
        const textContent = await page.getTextContent();
        
        textLayerDiv.innerHTML = '';
        
        // --- THIS IS THE FIX ---
        // We call renderTextLayer directly from the viewer module, without 'new'.
        await pdfjsViewer.renderTextLayer({
          textContentSource: textContent,
          container: textLayerDiv,
          viewport: viewport,
        }).promise;
        // --- END OF FIX ---

        onPageChange(textContent.items.map(item => item.str).join(' '));

      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.error("Error rendering page:", err);
          setError("Failed to render this page.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    renderPage();
    
    return () => {
      if (renderTask) {
        renderTask.cancel();
      }
    };
    
  }, [pdf, currentPage, onPageChange]);
  
  const goToPrevPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
  const goToNextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1));

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div>
      <div className="pdf-viewer-container">
        <canvas ref={canvasRef} className="pdf-canvas"></canvas>
        <div ref={textLayerRef} className="textLayer"></div>
      </div>
      <div className="reader-navigation">
        <button onClick={goToPrevPage} disabled={currentPage <= 1 || isLoading} className="nav-button">
          Previous Page
        </button>
        <span className="page-indicator">
          {isLoading ? 'Loading...' : `Page ${currentPage} of ${totalPages}`}
        </span>
        <button onClick={goToNextPage} disabled={currentPage >= totalPages || isLoading} className="nav-button">
          Next Page
        </button>
      </div>
    </div>
  );
}

export default PdfViewer;