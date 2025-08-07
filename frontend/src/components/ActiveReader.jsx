import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

function ActiveReader() {
    const { fileUrl: encodedFileUrl } = useParams();
    const fileUrl = decodeURIComponent(encodedFileUrl);

    const [pages, setPages] = useState([]);
    const [documentName, setDocumentName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!fileUrl) return;

        // Extract a readable name from the URL for display
        const nameFromUrl = fileUrl.split('%2F').pop().split('?')[0];
        setDocumentName(decodeURIComponent(nameFromUrl));

        const fetchDocumentText = async () => {
            try {
                const response = await fetch('/api/document/text', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileUrl }),
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
    }, [fileUrl]);

    if (isLoading) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading document...</div>;
    }

    if (error) {
        return <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>Error: {error}</div>;
    }

    return (
        <div style={{ padding: '1rem 2rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Active Reader: {documentName}</h1>
            <div style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1rem', height: '80vh', overflowY: 'auto', background: '#fff' }}>
                {pages.map((pageText, index) => (
                    <div key={index} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '2px dashed #eee' }}>
                        <h3 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Page {index + 1}</h3>
                        <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{pageText}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default ActiveReader;