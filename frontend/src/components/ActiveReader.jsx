import React, { useEffect, useState } from 'react';

function ActiveReader() {
    // This state will hold the file URL we get from the browser's address bar
    const [fileUrl, setFileUrl] = useState('');
    const [pages, setPages] = useState([]);
    const [documentName, setDocumentName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // When the component loads, get the full path from the URL
        const path = window.location.pathname;
        let decodedUrl = '';

        // Extract the encoded URL part
        if (path.startsWith('/read/')) {
            const encodedUrl = path.substring(6);
            decodedUrl = decodeURIComponent(encodedUrl);
            setFileUrl(decodedUrl);
        }

        if (!decodedUrl) {
            setIsLoading(false);
            setError("No document URL found in the address bar.");
            return;
        };

        // A little trick to get a clean document name from the long URL
        const nameFromUrl = decodedUrl.split('%2F').pop().split('?')[0];
        setDocumentName(decodeURIComponent(nameFromUrl));

        const fetchDocumentText = async () => {
            try {
                // This call goes to our backend endpoint
                const response = await fetch('/api/document/text', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileUrl: decodedUrl }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to fetch document text');
                }

                const data = await response.json();
                setPages(data.pages);
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDocumentText();
    }, []); // This effect only needs to run once when the component mounts

    if (isLoading) {
        return <div className="text-center p-8">Loading document...</div>;
    }

    if (error) {
        return <div className="text-center p-8 text-red-500">Error: {error}</div>;
    }

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-2xl font-bold mb-4 truncate">Active Reader: {documentName}</h1>
            <div className="bg-white border rounded-lg shadow-sm p-4 h-[80vh] overflow-y-auto">
                {pages.map((pageText, index) => (
                    <div key={index} className="page-content mb-4 pb-4 border-b-2 border-gray-200 border-dashed">
                        <h3 className="font-semibold text-lg mb-2 text-gray-500">Page {index + 1}</h3>
                        <p className="whitespace-pre-wrap leading-relaxed text-gray-800">
                            {pageText}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default ActiveReader;
