const AWS = require("aws-sdk");
const axios = require("axios");
const { v4: uuidv4 } = require('uuid');

// Configure AWS SDK with your credentials
const s3 = new AWS.S3({
  endpoint: process.env.S3_ENDPOINT,
  accessKeyId: process.env.S3_APP_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
});

// Function to get text as input to get audio file using ElevenLabs and return audio file url after uploading to s3 bucket
const getAudiourlFromText = async (inputText) => {
  // Get audio file with text using Elevenlabs api call
  const baseUrl = "https://api.elevenlabs.io/v1/text-to-speech";
  const headers = {
    accept: "audio/mpeg",
    "content-type": "application/json",
    "xi-api-key": process.env.ELEVEN_LABS_API_KEY,
  };
  const voiceSettings = {
    stability: 0,
    similarity_boost: 0,
  };

  const body = {
    text: inputText,
    voice_settings: voiceSettings,
  };

  // 25 female voiceId
  const voiceId = "p9vrwepzUyHduM7WKBD4"; 

  // Make the API call to ElevenLabs
  const response = await axios.post(`${baseUrl}/${voiceId}`, body, {
    headers,
    responseType: "arraybuffer", // To receive binary data in response
  });

  // Upload the audio file to s3
  const uploadKey = `${process.env.S3_DIR}/telnyx/${Date.now()}-${uuidv4()}.mp3`;

  const uploadResult = await s3.upload({
    Bucket: process.env.S3_BUCKET,
    Key: uploadKey,
    Body: response.data,
    ACL: "public-read",
    ContentType: 'audio/mpeg',
  }).promise();

  const audioUrl = uploadResult.Location;

  return audioUrl;
};

// Function to delete a file in S3 with its name (key)
const deleteFileFromS3 = async (fileName) => {
    try {
      const deleteParams = {
        Bucket: process.env.S3_BUCKET, // Your S3 Bucket name
        Key: fileName,                 // Name of the file (Key) you want to delete
      };
  
      const result = await s3.deleteObject(deleteParams).promise();
      console.log(`File deleted successfully: ${fileName}`, result);
    } catch (error) {
      console.error("An error occurred while deleting the file:", error);
    }
};
  

module.exports = {
  getAudiourlFromText,
  deleteFileFromS3
};