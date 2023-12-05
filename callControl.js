const express = require("express");
const telnyx = require("telnyx")(process.env.TELNYX_API_KEY);
const OpenAI = require("openai");
const openai = new OpenAI(process.env.OPENAI_API_KEY);
const router = (module.exports = express.Router());
const db = require("./db");
const { getAudiourlFromText, deleteFileFromS3 } = require("./utils");

const outboundCallController = async (req, res) => {
  console.log("++++++++++++++++++++++++++++++");
  res.sendStatus(200); // Send HTTP 200 OK to Telnyx immediately
  const event = req.body;
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
  try {
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
    let voice_audio_url;
    switch (event.event_type) {
      case "call_initiated":
        await call.answer();
        break;
      case "call_answered":
        // Generate the bot's response using call.speak
        // await call.speak({
        //   payload:
        //     "Good morning! Thank you for Martinez Cleaning Services. My name is Jessica. How can I help you today?",
        //   voice: "female",
        //   language: "en-US",
        // });
        voice_audio_url = await getAudiourlFromText(
          "Good morning! Thank you for Martinez Cleaning Services. My name is Jessica. How can I help you today?"
        );
        await call.playback_start({ audio_url: voice_audio_url });

        // Step : Begin transcription
        await call.transcription_start({
          language: "en",
          transcriptionEngine: "B",
          transcriptionTracks: "inbound",
        });

        break;
      case "transcription":
        console.log("****************************");
        if (index === 1) {
          const name = await getName(
            event.payload.transcription_data.transcript
              ? event.payload.transcription_data.transcript
              : ""
          );
          console.log(
            "Name----------------",
            name,
            event.payload.transcription_data.transcript
          );
          // await call.speak({
          //   payload: bot_answers[index % 2].replaceAll("#NAME", name),
          //   voice: "female",
          //   language: "en-US",
          // });
          voice_audio_url = await getAudiourlFromText(
            bot_answers[index % 2].replaceAll("#NAME", name)
          );
          await call.playback_start({ audio_url: voice_audio_url });
          index++;

          await call.playback_start({
            audio_url:
              "https://snaprise-storage.sgp1.digitaloceanspaces.com/project/files/user/1701459526866-b3d20e31-a349-4172-b6de-bf7893896367-waiting_music.mp3",
          });

          await sleepFunction(7000);

          // Transfter after 7 secs
          console.log("call trasfer after 7 secs");
          const webhook_url = new URL(
            "/call-control/outbound",
            `${req.protocol}://${req.hostname}`
          ).href;
          await call.transfer({
            // to: '+19783840927',
            to: "+19704391477",
            // to: "+13522344952",
            webhook_url,
          });
          console.log("Call Transfered!");
        } else if (index == 0) {
          // await call.speak({
          //   payload: bot_answers[index % 2],
          //   voice: "female",
          //   language: "en-US",
          // });
          voice_audio_url = await getAudiourlFromText(
            bot_answers[index % 2]
          );
          await call.playback_start({ audio_url: voice_audio_url });
          
        }

        index++;
        break;
      case "call_hangup":
        // handleInboundHangup(call, event);
        break;
      case "playback_eneded":
        await deleteFileFromS3(voice_audio_url.split(".com/")[1]);
      default:
        console.log(
          `Received Call-Control event: ${event.event_type} DLR with call_session_id: ${call.call_session_id}`
        );
    }
  } catch (error) {
    console.log(error);
  }
};

// Function to generate the bot's response using OpenAI
async function getName(userInput) {
  const completions = await openai.completions.create({
    model: "text-davinci-003",
    prompt: `Tell me the user's name with one word from the following user's response : ${userInput}`,
    max_tokens: 10,
  });
  let inputString = completions.choices[0].text;

  // Split the string by newline and filter out empty strings
  let wordsAfterNewline = inputString.split("\n").filter(Boolean);

  // Get the last word after the last newline
  let lastName = wordsAfterNewline.pop();

  return lastName;
}

// Function to delay some time
const sleepFunction = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
router.route("/outbound").post(outboundCallController);

router.route("/inbound").post(inboundCallController);

router.route("/test").get(async (req, res) => {
  const audioUrl = await getAudiourlFromText(
    "hello guys, How are you? I want to introduce myself now"
  );
  console.log("audioUrl:", audioUrl);

  // Delete this file once used to reduce s3 capacity used
  // await deleteFileFromS3(audioUrl.split(".com/")[1]);
  res.send(audioUrl);
});
