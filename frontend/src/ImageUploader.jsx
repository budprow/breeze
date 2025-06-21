import React, { useState } from 'react';

function ImageUploader() {
  // 'useState' is a React Hook. It lets us create a "state variable" to hold data.
  // 'selectedFile' will hold the file the user picks. It starts as 'null'.
  // 'setSelectedFile' is the function we use to update it.
  const [selectedFile, setSelectedFile] = useState(null);

  // This function runs when the user selects a file from the dialog box.
  const handleFileChange = (event) => {
    // 'event.target.files' is a list of files the user selected. We only want the first one.
    const file = event.target.files[0];
    if (file) {
      // If a file was selected, we update our state variable with that file object.
      setSelectedFile(file);
    }
  };

  return (
    <div style={{ textAlign: 'center', border: '2px dashed #ccc', padding: '20px', borderRadius: '10px' }}>
      
      {/* This is the actual file input, but we'll hide it because it's ugly. */}
      <input 
        type="file"
        id="fileInput" 
        accept="image/*" // This ensures the user can only select image files.
        onChange={handleFileChange}
        style={{ display: 'none' }} 
      />

      {/* This is a styled label that LOOKS like a button. Clicking it will trigger the hidden input. */}
      <label htmlFor="fileInput" style={{ cursor: 'pointer', padding: '10px 20px', backgroundColor: '#007bff', color: 'white', borderRadius: '5px' }}>
        Choose an Image
      </label>

      {/* This area provides feedback to the user. */}
      <div style={{ marginTop: '15px' }}>
        {selectedFile ? (
          // If a file has been selected, display its name.
          <p>Selected file: {selectedFile.name}</p>
        ) : (
          // If no file is selected, show this message.
          <p>Please select an image to begin.</p>
        )}
      </div>

    </div>
  );
}

export default ImageUploader;