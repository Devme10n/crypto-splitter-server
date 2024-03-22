// src/components/FileHandler.js
import React, { useState } from 'react';
import { encryptDataWithAES, exportAndEncryptSymmetricKey, generateSymmetricKey, decryptSymmetricKey, decryptFile } from '../utils/crypto';

function FileHandler({ publicKey, privateKey, setDownloadUrl }) { // Add privateKey as a prop
  const [file, setFile] = useState(null);
  const [encryptedFileURL, setEncryptedFileURL] = useState(null);
  const [encryptedSymmetricKey, setEncryptedSymmetricKey] = useState(null);
  const [error, setError] = useState('');
  const [localSymmetricKey, setLocalSymmetricKey] = useState(null);

  // 파일 변경 이벤트 핸들러
  const handleFileChange = (event) => {
      const selectedFile = event.target.files[0];
      setFile(selectedFile);
      setError(''); // 새 파일이 선택될 때마다 에러 메시지 초기화
  };

  const handleEncryptAndSend = async () => {
    if (!file) {
      setError('파일을 선택해 주세요.');
      return;
    }
  
    if (!publicKey) {
      setError('키 생성이 완료되지 않았습니다. "키 생성" 버튼을 클릭해주세요.');
      return;
    }
  
    try {
      const newSymmetricKey = await generateSymmetricKey();
  
      console.log("Encrypting with file:", file);
      const fileData = await file.arrayBuffer();
  
      const encryptedDataResult = await encryptDataWithAES(fileData, newSymmetricKey);
      if (!encryptedDataResult.encryptedData) {
        throw new Error("Invalid encrypted data");
      }
  
      const encryptedDataBlob = new Blob([encryptedDataResult.encryptedData], { type: 'application/octet-stream' });
      const encryptedDataBlobURL = URL.createObjectURL(encryptedDataBlob);
      setEncryptedFileURL(encryptedDataBlobURL);
  
      const encryptedKeyArrayBuffer = await exportAndEncryptSymmetricKey(publicKey, newSymmetricKey);
  
      // Check if privateKey is available
      if (!privateKey) {
        throw new Error('개인 키가 없습니다.');
      }
  
      // Assuming decryptedSymmetricKey is the result from decryptSymmetricKey
      const decryptedSymmetricKeyData = await decryptSymmetricKey(privateKey, encryptedKeyArrayBuffer);
      console.log('Type of decryptedSymmetricKeyData:', typeof decryptedSymmetricKeyData);
      console.log('Is decryptedSymmetricKeyData an instance of ArrayBuffer?', decryptedSymmetricKeyData instanceof ArrayBuffer);


      // Convert the raw key back into a CryptoKey
      const importedSymmetricKey = await window.crypto.subtle.importKey(
        "raw",
        decryptedSymmetricKeyData,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      );

      // Now use importedSymmetricKey for decryption
      const decryptedDataArrayBuffer = await decryptFile(encryptedDataResult.encryptedData, importedSymmetricKey);  
  
      if (decryptedDataArrayBuffer) {
        // Convert ArrayBuffer to Blob for displaying or downloading
        const decryptedDataBlob = new Blob([decryptedDataArrayBuffer], { type: 'application/octet-stream' });
        const decryptedDataURL = URL.createObjectURL(decryptedDataBlob);
        console.log("Decrypted data URL for testing:", decryptedDataURL);
        // Set the URL for downloading decrypted data
        setDownloadUrl(decryptedDataURL);
      } else {
        throw new Error("Decryption returned no data");
      }
  
    } catch (error) {
      console.error("Encryption/Decryption process failed:", error);
      setError(`Encryption/Decryption process failed: ${error.message}`);
    }
  };

  return (
      <div>
          <input type="file" onChange={handleFileChange} />
          <button onClick={handleEncryptAndSend}>암호화 & 업로드</button>
          {encryptedFileURL && <a href={encryptedFileURL} download="encrypted_file.dat">암호화된 파일 다운로드</a>}
          {error && <p>오류: {error}</p>}
      </div>
  );
}

export default FileHandler;

// // src/components/FileHandler.js
// // 테스트 완료
// import React, { useState } from 'react';
// import { encryptDataWithAES, exportAndEncryptSymmetricKey, generateSymmetricKey, decryptSymmetricKey, decryptFile } from '../utils/crypto';

// function FileHandler({ publicKey, privateKey, setDownloadUrl }) { // Add privateKey as a prop
//   const [file, setFile] = useState(null);
//   const [encryptedFileURL, setEncryptedFileURL] = useState(null);
//   const [encryptedSymmetricKey, setEncryptedSymmetricKey] = useState(null);
//   const [error, setError] = useState('');
//   const [localSymmetricKey, setLocalSymmetricKey] = useState(null);

//   // 파일 변경 이벤트 핸들러
//   const handleFileChange = (event) => {
//       const selectedFile = event.target.files[0];
//       setFile(selectedFile);
//       setError(''); // 새 파일이 선택될 때마다 에러 메시지 초기화
//   };

//   // 암호화 및 전송 처리 함수
//   const handleEncryptAndSend = async () => {
//     // 파일이 선택되었는지 확인
//     if (!file) {
//         setError('파일을 선택해 주세요.');
//         return;
//     }

//     // 공개키가 생성되었는지 확인
//     if (!publicKey) {
//         setError('키 생성이 완료되지 않았습니다. "키 생성" 버튼을 클릭해주세요.');
//         return;
//     }

//     try {
//         // 새 대칭키 생성
//         const newSymmetricKey = await generateSymmetricKey();
//         setLocalSymmetricKey(newSymmetricKey);

//         // 파일 로깅 및 ArrayBuffer로 변환
//         console.log("Encrypting with file:", file);
//         const fileData = await file.arrayBuffer();
//         console.log("Type of file after arrayBuffer conversion:", typeof fileData);

//         // 대칭키 로깅
//         console.log("Symmetric Key:", newSymmetricKey);
//         console.log("Type of Symmetric Key:", newSymmetricKey.constructor.name);

//         // 파일 암호화 시도
//         try {
//           const encryptedData = await encryptDataWithAES(fileData, newSymmetricKey);
//           console.log("Encrypted data:", encryptedData);
//             if (!(encryptedData && encryptedData.encryptedData)) {
//                 throw new Error("Invalid encrypted data");
//             }
//             const encryptedDataBlob = new Blob([encryptedData.encryptedData], { type: 'application/octet-stream' });
//             const encryptedDataBlobURL = URL.createObjectURL(encryptedDataBlob);
//             setEncryptedFileURL(encryptedDataBlobURL);
//             // setDownloadUrl(encryptedDataBlobURL); // 다운로드 URL 설정(Download File 링크 생성)
//         } catch (encryptError) {
//             // 파일 암호화 실패 처리
//             console.error("파일 암호화 실패:", encryptError);
//             setError('파일 암호화 실패: ' + encryptError.message);
//             return; // 암호화 실패시 함수 종료
//         }

//         // 대칭키 암호화 시도
//         try {
//             const encryptedKeyArrayBuffer = await exportAndEncryptSymmetricKey(publicKey, newSymmetricKey);
//             const encryptedKeyBlob = new Blob([encryptedKeyArrayBuffer]);
//             const encryptedKeyBlobURL = URL.createObjectURL(encryptedKeyBlob);
//             setEncryptedSymmetricKey(encryptedKeyBlobURL);
//         } catch (encryptKeyError) {
//             // 대칭키 암호화 실패 처리
//             console.error("대칭키 암호화 실패:", encryptKeyError);
//             setError('대칭키 암호화 실패: ' + encryptKeyError.message);
//             return; // 암호화 실패시 함수 종료
//         }

//     } catch (generalError) {
//         // 일반 오류 처리
//         console.error("암호화 프로세스 실패:", generalError);
//         setError('암호화 프로세스 실패: ' + generalError.message);
//     }
//   };

//   return (
//       <div>
//           <input type="file" onChange={handleFileChange} />
//           <button onClick={handleEncryptAndSend}>암호화 & 업로드</button>
//           {encryptedFileURL && <a href={encryptedFileURL} download="encrypted_file.dat">암호화된 파일 다운로드</a>}
//           {error && <p>오류: {error}</p>}
//       </div>
//   );
// }

// export default FileHandler;


// // src/components/FileHandler.js
// 전송 테스트 안함
// import React, { useState } from 'react';
// import { encryptDataWithAES, exportAndEncryptSymmetricKey, generateSymmetricKey } from '../utils/crypto';

// function FileHandler({ publicKey, setDownloadUrl }) {
//     const [file, setFile] = useState(null);
//     const [error, setError] = useState('');

//     // 파일 변경 이벤트 핸들러
//     const handleFileChange = (event) => {
//         setFile(event.target.files[0]);
//         setError(''); // 새 파일 선택 시 에러 메시지 초기화
//     };

//     // 데이터 암호화 및 준비 함수
//     const encryptAndPrepareData = async () => {
//         const newSymmetricKey = await generateSymmetricKey();
//         const encryptedDataBlob = await encryptDataWithAES(file, newSymmetricKey);
//         const encryptedKeyArrayBuffer = await exportAndEncryptSymmetricKey(publicKey, newSymmetricKey);
//         return {
//             encryptedFile: encryptedDataBlob,
//             encryptedKey: new Blob([encryptedKeyArrayBuffer]),
//         };
//     };

//     // 암호화된 데이터 업로드 함수
//     const uploadEncryptedData = async (encryptedFile, encryptedKey) => {
//         const formData = new FormData();
//         formData.append('encryptedFile', encryptedFile);
//         formData.append('encryptedKey', encryptedKey);

//         const response = await fetch('YOUR_SERVER_ENDPOINT', {
//             method: 'POST',
//             body: formData,
//         });

//         if (!response.ok) {
//             throw new Error('파일 업로드 실패');
//         }

//         console.log('파일 및 키 업로드 성공');
//     };

//     // 암호화 및 업로드 처리 함수
//     const handleEncryptAndSend = async () => {
//         if (!file) {
//             setError('파일을 선택해 주세요.');
//             return;
//         }

//         if (!publicKey) {
//             setError('"키 생성" 버튼을 클릭하여 키 생성을 완료해 주세요.');
//             return;
//         }

//         try {
//             const { encryptedFile, encryptedKey } = await encryptAndPrepareData();
//             await uploadEncryptedData(encryptedFile, encryptedKey);
//             setError(''); // 기존 에러 메시지 초기화
//         } catch (error) {
//             console.error('처리 실패:', error);
//             setError('처리 실패: ' + error.message);
//         }
//     };

//     return (
//         <div>
//             <input type="file" onChange={handleFileChange} />
//             <button onClick={handleEncryptAndSend}>암호화 및 업로드</button>
//             {error && <p>오류: {error}</p>}
//         </div>
//     );
// }

// export default FileHandler;