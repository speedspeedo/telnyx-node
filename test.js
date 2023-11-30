require("dotenv").config();

const telnyx = require("telnyx")(`${process.env.TELNYX_API_KEY}`);

async function createCall() {
  try {
    const { data: call } = await telnyx.calls.create({
      connection_id: `${process.env.TELNYX_CONNECTION_ID}`,
      from: '+13522344952',
      to: process.env.TELNYX_Number,
    });

    await call.answer();

    const speakResponse = await call.speak({
      payload: "Hi! Adrian. I am a YODAN.",
      voice: "female",
      language: "en-US",
    });
    console.log(speakResponse);
  } catch (error) {
    console.error("Error creating a call:", error);
  }
}

// Call the async function
createCall();
