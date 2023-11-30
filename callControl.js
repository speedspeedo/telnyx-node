const express = require("express");
const telnyx = require("telnyx")(process.env.TELNYX_API_KEY);
const OpenAI = require("openai");
const openai = new OpenAI(process.env.OPENAI_API_KEY);
const router = (module.exports = express.Router());
const db = require("./db");

const outboundCallController = async (req, res) => {
  res.sendStatus(200); // Send HTTP 200 OK to Telnyx immediately
  const event = req.body.data;
  const callIds = {
    call_control_id: event.payload.call_control_id,
    call_session_id: event.payload.call_session_id,
    call_leg_id: event.payload.call_leg_id,
  };
  console.log(
    `Received Call-Control event: ${event.event_type} DLR with call_session_id: ${callIds.call_session_id}`
  );
};

const handleInboundAnswer = async (call, event, req) => {
  console.log(
    `call_session_id: ${call.call_session_id}; event_type: ${event.event_type}`
  );
  try {
    const webhook_url = new URL(
      "/call-control/outbound",
      `${req.protocol}://${req.hostname}`
    ).href;
    const destinationPhoneNumber = db.getDestinationPhoneNumber(
      event.payload.to
    );
    await call.transfer({
      to: destinationPhoneNumber,
      webhook_url,
    });
  } catch (e) {
    console.log(
      `Error transferring on call_session_id: ${call.call_session_id}`
    );
    console.log(e);
  }
};

const handleInboundHangup = (call, event) => {
  console.log(
    `call_session_id: ${call.call_session_id}; event_type: ${event.event_type}`
  );
  db.saveCall(event);
};

const bot_answers = [
  "Okay, I can certainly get someone to help you with that. May I have your name, please?",
  "Thank you, #NAME. Please allow me a few moments to get someone who can assist you, please hold.",
];

let index = 0;

const inboundCallController = async (req, res) => {
  console.log("START!");
  res.sendStatus(200); // Send HTTP 200 OK to Telnyx immediately
  const event = req.body;
  console.log(event.event_type);
  console.log("_______________________________________________");
  console.log(req.body);
  const callIds = {
    call_control_id: event.payload.call_control_id,
    call_session_id: event.payload.call_session_id,
    call_leg_id: event.payload.call_leg_id,
  };
  const call = new telnyx.Call(callIds);
  switch (event.event_type) {
    case "call_initiated":
      await call.answer();
      break;
    case "call_answered":
      // Generate the bot's response using call.speak
      await call.speak({
        payload:
          "Good morning! Thank you for Martinez Cleaning Services. My name is Jessica. How can I help you today?",
        voice: "female",
        language: "en-US",
      });

      // Step : Begin transcription
      await call.transcription_start({
        language: "en",
        transcriptionEngine: "B",
        transcriptionTracks: "inbound",
      });
      // const userInput = await call.transcription();
      // const response = await generateResponse(userInput);

      break;
    case "transcription":
      console.log("****************************");
      // Speak the response back to the caller
      if (index === 1) {
        const name = getName(event.payload.transcription_data.transcript ? event.payload.transcription_data.transcript : "");
        console.log(name, event.payload.transcription_data.transcript);
        await call.speak({
          payload: bot_answers[index].replaceAll("#NAME", name),
          voice: "female",
          language: "en-US",
        });
      } else {
        await call.speak({
          payload: bot_answers[index],
          voice: "female",
          language: "en-US",
        });
      }
      
      index++;
      break;
    case "call_hangup":
      handleInboundHangup(call, event);
      break;
    default:
      console.log(
        `Received Call-Control event: ${event.event_type} DLR with call_session_id: ${call.call_session_id}`
      );
  }
};

// Function to generate the bot's response using OpenAI
async function getName(userInput) {
  const completions = await openai.completions.create({
    model: "text-davinci-003",
    prompt: `Tell me the user's name with one word from the following user's response: ${userInput}`,
    max_tokens: 50,
  });
  return completions.choices[0].text.trim();
}

router.route("/outbound").post(outboundCallController);

router.route("/inbound").post(inboundCallController);

router.route("/test").get((req, res) => {
  res.send("Test");
});
