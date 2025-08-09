import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// --- FIX #1: The correct import for the text layer rendering function ---
import { renderTextLayer } from 'pdfjs-dist/web/pdf_viewer.mjs';
import 'pdfjs-dist/web/pdf_viewer.css';
import './PdfViewer.css';

// Set the worker source for the library
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

function PdfViewer({ fileUrl, onPageChange, onDocumentLoad }) {
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const renderTask = useRef(null); // Use a ref to hold the render task

  // Effect to load the PDF document once when the component mounts or fileUrl changes
  useEffect(() => {
    const loadPdf = async () => {
      if (!fileUrl) return;
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
    loadPdf();
  }, [fileUrl, onDocumentLoad]);

  // Effect to render a page whenever the PDF document or current page number changes
  useEffect(() => {
    if (!pdf) return;

    // Cancel any previous render task to prevent race conditions and errors
    if (renderTask.current) {
      renderTask.current.cancel();
    }

    const renderPage = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const page = await pdf.getPage(currentPage);
        const viewport = page.getViewport({ scale: 1.5 });
        
        // Prepare canvas for rendering
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render the visual PDF page onto the canvas
        renderTask.current = page.render({
          canvasContext: context,
          viewport: viewport,
        });
        await renderTask.current.promise;

        // Prepare the text layer div
        const textLayerDiv = textLayerRef.current;
        textLayerDiv.innerHTML = ''; // Clear previous content
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;

        // Get the text content from the page
        const textContent = await page.getTextContent();

        // --- FIX #2: Call the correctly imported renderTextLayer function ---
        // This is the modern, correct API call.
        await renderTextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport: viewport,
        }).promise;
        // --- END OF FIX ---

        // Pass the extracted text up to the parent `ActiveReader` component
        onPageChange(textContent.items.map(item => item.str).join(' '));

      } catch (err) {
        // We ignore the "RenderingCancelledException" as it's an expected part of the logic
        if (err.name !== 'RenderingCancelledException') {
          console.error("Error rendering page:", err);
          setError("Failed to render this page.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    renderPage();

  }, [pdf, currentPage, onPageChange]);

  const goToPrevPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
  const goToNextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1));

  if (error) {
    return <div className="error-message" style={{ color: 'red', textAlign: 'center' }}>{error}</div>;
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