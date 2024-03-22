// src/utils/crypto.js

import axios from 'axios';

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

export async function generateKeyAndIv() {
  // 안전한 랜덤 비밀번호 생성
  const password = window.crypto.getRandomValues(new Uint8Array(16));
  const AES_password_file = Array.from(password, byte => ('00' + byte.toString(16)).slice(-2)).join('');
  console.log('AES_password_file:', AES_password_file); // 로그 추가

  // salt 생성
  const salt = 'saltForFile';
  const encoder = new TextEncoder();
  const saltUint8Array = encoder.encode(salt);

  // 파일용 대칭키 생성
  const AES_key_file = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(AES_password_file),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
  );
  console.log('AES_key_file:', AES_key_file); // 로그 추가

  const derivedKey = await window.crypto.subtle.deriveKey(
      {
          name: 'PBKDF2',
          salt: saltUint8Array,
          iterations: 1000,
          hash: 'SHA-256'
      },
      AES_key_file,
      { name: 'AES-CBC', length: 256 },
      false,
      ['encrypt', 'decrypt']
  );
  console.log('derivedKey:', derivedKey); // 로그 추가

  // 파일용 초기화 벡터 생성
  const AES_iv_file = window.crypto.getRandomValues(new Uint8Array(16));
  console.log('AES_iv_file:', AES_iv_file); // 로그 추가

  return { AES_password_file, derivedKey, AES_iv_file };
}


// TODO: 대용량 파일(아마 2기가 이상)의 경우 server-side한 선택지를 제공하기
export async function encryptAndUploadFile(file, derivedKey, iv, publicKey) {
  // 파일을 암호화합니다.
  const arrayBuffer = await file.arrayBuffer();
  const encryptedData = await window.crypto.subtle.encrypt(
    {
      name: 'AES-CBC',
      iv: iv,
    },
    derivedKey,
    arrayBuffer
  );
  console.log('encryptedData:', encryptedData); // 로그 추가

  // iv를 암호화된 데이터 앞에 붙입니다.
  const ivAndEncryptedData = new Uint8Array(iv.byteLength + encryptedData.byteLength);
  ivAndEncryptedData.set(new Uint8Array(iv), 0);
  ivAndEncryptedData.set(new Uint8Array(encryptedData), iv.byteLength);

  // 대칭키를 공개키로 암호화합니다.
  const encryptedKey = await window.crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP',
    },
    publicKey,
    derivedKey
  );
  console.log('encryptedKey:', encryptedKey); // 로그 추가

  // 암호화된 파일과 대칭키를 서버로 업로드합니다.
  const formData = new FormData();
  formData.append('file', new Blob([ivAndEncryptedData]), file.name);
  formData.append('key', new Blob([new Uint8Array(encryptedKey)]));
  const response = await axios.post('https://example.com/api/upload', formData);

  if (response.status === 200) {
    console.log('File uploaded successfully');
  } else {
    console.error('File upload failed', response);
  }
}