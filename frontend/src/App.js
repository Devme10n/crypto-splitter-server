// src/App.js
import React, { useState } from 'react';
import FileHandler from './components/FileHandler';
import CryptoFunctions from './components/CryptoFunctions';
import { generateRSAKeys } from './utils/crypto';

function App() {
  const [file, setFile] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [publicKey, setPublicKey] = useState(null);
  const [privateKey, setPrivateKey] = useState(null);
  const [symmetricKey, setSymmetricKey] = useState(null);

  // 파일 선택 핸들러
  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  // 키 생성 핸들러
  const handleKeyGeneration = async () => {
    console.log('RSA 키 생성 중...'); // 키 생성 시작 로그
    const keys = await generateRSAKeys();
    setPublicKey(keys.publicKey);
    setPrivateKey(keys.privateKey);
    console.log('RSA 키 생성 완료'); // 키 생성 완료 로그
  };

  return (
    <div>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleKeyGeneration}>Generate Keys</button>
      <FileHandler 
        file={file}
        symmetricKey={symmetricKey} 
        setDownloadUrl={setDownloadUrl} 
        publicKey={publicKey} 
        privateKey={privateKey}
      />
      <CryptoFunctions 
        setPublicKey={setPublicKey}
        setPrivateKey={setPrivateKey}
        setSymmetricKey={setSymmetricKey}
        publicKey={publicKey}
        privateKey={privateKey}
        symmetricKey={symmetricKey}
      />
      {/* {downloadUrl && <a href={downloadUrl} download="encrypted_file">Download File</a>} */}
    </div>
  );
}

export default App;