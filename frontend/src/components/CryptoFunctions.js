// src/components/CryptoFunctions.js
import React, { useState } from 'react';
import { generateRSAKeys } from '../utils/crypto';

function CryptoFunctions({ setPublicKey, setPrivateKey }) {
  // 키 생성 완료 메시지를 위한 상태 추가
  const [keyGenerationMessage, setKeyGenerationMessage] = useState('');

  const handleKeyGeneration = async () => {
    try {
      // 키 생성 함수 호출
      const keys = await generateRSAKeys();
      // 공개키와 비밀키를 상위 컴포넌트로 업데이트
      setPublicKey(keys.publicKey);
      setPrivateKey(keys.privateKey);
      // 키 생성 완료 메시지 설정
      setKeyGenerationMessage('RSA 키 생성이 성공적으로 완료되었습니다.');
    } catch (error) {
      // 오류 발생 시 메시지 업데이트
      setKeyGenerationMessage('RSA 키 생성 중 오류가 발생했습니다.');
    }
  };

  return (
    <div>
      <button onClick={handleKeyGeneration}>Generate Keys</button>
      {keyGenerationMessage && <p>{keyGenerationMessage}</p>}
      {/* 다른 버튼과 로직을 여기에 추가 */}
    </div>
  );
}

export default CryptoFunctions;