require("dotenv").config();

const telnyx = require("telnyx")(`${process.env.TELNYX_API_KEY}`);
const OpenAI = require("openai");
const openai = new OpenAI(process.env.OPENAI_API_KEY);

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

async function generateResponse(userInput) {
  const completions = await openai.completions.create({
    model: "text-davinci-003",
    prompt: `Tell me the user's name with one word from the following user's response: ${userInput}`,
    max_tokens: 50,
  });
  console.log(completions.choices[0].text.trim());
}


// Call the async function
generateResponse("I'm Jake Miller");
