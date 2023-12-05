require("dotenv").config();

const telnyx = require("telnyx")(`${process.env.TELNYX_API_KEY}`);
const OpenAI = require("openai");
const openai = new OpenAI(process.env.OPENAI_API_KEY);

async function createCall() {
  try {
    const { data: call } = await telnyx.calls.create({
      connection_id: `${process.env.TELNYX_CONNECTION_ID}`,
      to: '+12069059357',
      from: process.env.TELNYX_Number,
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

// createCall();

async function generateResponse(userInput) {
  const completions = await openai.completions.create({
    model: "text-davinci-003",
    prompt: `Tell me the user's name with one word from the following user's response : ${userInput}`,
    max_tokens: 10,
  });
  let inputString = completions.choices[0].text;

  // Split the string by newline and filter out empty strings
  let wordsAfterNewline = inputString.split('\n').filter(Boolean);

  // Get the last word after the last newline
  let lastName = wordsAfterNewline.pop();

  console.log(lastName);
}


// Call the async function
generateResponse(" Mike");
