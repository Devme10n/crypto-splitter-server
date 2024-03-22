// src/utils/crypto.js

// TODO: RSA 키가 없는 경우 최초 1회에만 키를 생성, 그 이후에는 로컬 스토리지에서 가져오도록 수정, 키 생성 후 로컬 스토리지에 저장
// RSA 키 생성 함수
export const generateRSAKeys = async () => {
    // RSA 키 쌍 생성
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 4096,
            publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
            hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
    );
    // RSA 키 쌍 반환
    return keyPair;
};

// AES-GCM 대칭 키를 사용한 데이터 암호화 함수
export const encryptDataWithAES = async (arrayBuffer, symmetricKey) => {
    // AES-GCM 암호화에 필요한 초기화 벡터 생성
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    console.log("AES-GCM 암호화를 위한 IV:", iv);
    // 데이터 암호화 시도
    try {
        const encryptedData = await window.crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv,
            },
            symmetricKey,
            arrayBuffer
        );
        // 암호화 성공 로그 출력
        console.log("데이터 암호화 성공");
        // 암호화된 데이터 및 IV 반환
        return { encryptedData, iv };
    } catch (error) {
        // 암호화 실패 시 오류 로그 출력
        console.error("데이터 암호화 실패:", error);
        throw error;
    }
};
  
// AES-GCM을 사용한 대칭키로 파일 데이터를 복호화하는 함수
export const decryptFile = async (encryptedData, symmetricKey) => {
    if (encryptedData && symmetricKey) {
      const iv = new Uint8Array(12); // 암호화에 사용된 동일한 초기화 벡터(IV).
      try {
        const decryptedData = await window.crypto.subtle.decrypt(
          { name: "AES-GCM", iv },
          symmetricKey,
          encryptedData
        );
        console.log("파일 데이터 복호화 성공");
        return decryptedData; // 복호화된 데이터를 반환
      } catch (error) {
        console.error("파일 데이터 복호화 실패:", error);
        throw error; // 에러를 다시 발생시키기
      }
    }
  };
  
  // RSA 공개키를 사용하여 대칭키를 암호화하는 함수
  export const exportAndEncryptSymmetricKey = async (publicKey, symmetricKey) => {
    if (publicKey && symmetricKey) {
      try {
        const exportedKey = await window.crypto.subtle.exportKey("raw", symmetricKey);
        const encryptedSymmetricKey = await window.crypto.subtle.encrypt(
          { name: "RSA-OAEP" },
          publicKey,
          exportedKey
        );
        console.log("대칭키 암호화 성공");
        return encryptedSymmetricKey; // 암호화된 대칭키를 반환
      } catch (error) {
        console.error("대칭키 암호화 실패:", error);
        throw error; // 에러를 다시 발생시키기
      }
    }
  };
  
  // RSA 개인키를 사용하여 암호화된 대칭키를 복호화하는 함수
  export const decryptSymmetricKey = async (privateKey, encryptedSymmetricKey) => {
    if (privateKey && encryptedSymmetricKey) {
      try {
        const decryptedKey = await window.crypto.subtle.decrypt(
          { name: "RSA-OAEP" },
          privateKey,
          encryptedSymmetricKey
        );
        const importedKey = await window.crypto.subtle.importKey(
          "raw",
          decryptedKey,
          { name: "AES-GCM" },
          true,
          ["encrypt", "decrypt"]
        );
        console.log("대칭키 복호화 및 가져오기 성공");
        return importedKey; // 복호화 및 가져온 대칭키를 반환
      } catch (error) {
        console.error("대칭키 복호화 실패:", error);
        throw error; // 에러를 다시 발생시키기
      }
    }
  };

// AES-GCM을 사용하여 대칭키를 생성하는 함수
export const generateSymmetricKey = async () => {
    return await window.crypto.subtle.generateKey(
        {
            name: "AES-GCM",
            length: 256, // 혹은 보안 요구에 따라 128 선택 가능
        },
        true, // 키가 추출 가능한지 여부 (즉, exportKey에서 사용할 수 있는지)
        ["encrypt", "decrypt"] // "encrypt", "decrypt", "wrapKey", "unwrapKey" 중 사용할 수 있음
    );
};

// 대칭키를 사용하여 데이터를 암호화하는 함수
export const encryptData = async (symmetricKey, data) => {
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // AES-GCM용 초기화 벡터

    const encryptedData = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv,
        },
        symmetricKey, // generateSymmetricKey에서 생성된 대칭키
        data // 암호화하려는 데이터의 ArrayBuffer
    );

    return { encryptedData, iv }; // 암호화된 데이터와 IV 반환
};

// 대칭키를 사용하여 데이터를 복호화하는 함수
export const decryptData = async (symmetricKey, encryptedData, iv) => {
    const decryptedData = await window.crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv,
        },
        symmetricKey, // generateSymmetricKey에서 생성된 대칭키
        encryptedData // 복호화하려는 데이터의 ArrayBuffer
    );

    return new Uint8Array(decryptedData); // 복호화된 데이터를 사용 가능한 형식으로 변환
};