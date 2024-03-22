import React, { useState } from 'react';
import { generateRSAKeys, generateKeyAndIv, encryptAndUploadFile } from '../utils/crypto';

function FileUploader() {
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFile(file);
    }
  }

  const handleEncryptAndSend = async () => {
    if (!file) {
      setError('파일을 선택해주세요.');
      return;
    }

    try {
      // RSA 키 쌍 생성
      const { publicKey, privateKey } = await generateRSAKeys();

      // 대칭키와 IV 생성
      const { key, iv } = generateKeyAndIv();

      // 파일 암호화 및 업로드
      await encryptAndUploadFile(file, key, iv, publicKey);
    } catch (err) {
      setError('파일 업로드 중 오류가 발생했습니다.');
    }
  }

  return (
    <div>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleEncryptAndSend}>암호화 & 업로드</button>
      {error && <p>오류: {error}</p>}
    </div>
  );
}

export default FileUploader;