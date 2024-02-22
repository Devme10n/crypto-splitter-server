const path = require('path');
const { encryptAndSplitFile } = require('./file-processing/writer');
const { renameFilesAndCreateMapping, uploadFiles } = require('./file-processing/middle');

// Set original file path
const originalFilePath = path.join(__dirname, 'uploadfile', 'dummyfile');

// Set the number of pieces to split
const splitCount = 100; // Use random value as example

// Call file encryption and splitting functions
encryptAndSplitFile(originalFilePath, splitCount)
    .then(({ originalFileNames, splitFilesPath }) => {
        console.log('The file name was encrypted and the file was split successfully.');
        console.log('Number of split files:', originalFileNames.length);
        console.log('Path where the split files are saved:', splitFilesPath);

        console.log('splitFilesPath:', splitFilesPath);
        console.log('예시 원본 파일 이름:', originalFileNames[0]);


        // Change file name and generate mapping information
        renameFilesAndCreateMapping(originalFileNames, splitFilesPath)
            .then(({ renamedFilePaths, splitFileOrderMapping }) => {
                console.log('File name change and mapping information creation completed.');
                console.log('Changed file paths:', renamedFilePaths);
                console.log('File mapping information:', splitFileOrderMapping);

                // file upload
                const uploadUrl = 'http://localhost:3000/upload'; // Set URL to upload
                uploadFiles(renamedFilePaths, uploadUrl)
                    .then(() => {
                        console.log('File upload completed.');
                        // Add logic to save file mapping information here
                    })
                    .catch(error => {
                        console.error('An error occurred while uploading file:', error);
                    });
            })
            .catch(error => {
                console.error('An error occurred while changing the file name and creating mapping information:', error);
            });
    })
    .catch(error => {
        console.error('An error occurred while processing and splitting the file:', error);
    });
