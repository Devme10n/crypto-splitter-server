import React, { useState } from 'react';
import FileUploader from './components/FileUploader';
import CryptoFunctions from './components/CryptoFunctions';

function App() {
  const [file, setFile] = useState(null);
  const [publicKey, setPublicKey] = useState(null);
  const [privateKey, setPrivateKey] = useState(null);
  const [symmetricKey, setSymmetricKey] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  return (
    <div>
      <CryptoFunctions setPublicKey={setPublicKey} setPrivateKey={setPrivateKey} />
      <FileUploader 
        file={file}
        symmetricKey={symmetricKey} 
        setDownloadUrl={setDownloadUrl} 
        publicKey={publicKey} 
        privateKey={privateKey}
      />
    </div>
  );
}

export default App;