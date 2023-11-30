const express = require("express");
const telnyx = require("telnyx")(process.env.TELNYX_API_KEY);
const OpenAI = require('openai');
const openai = new OpenAI(process.env.OPENAI_API_KEY);
const router = (module.exports = express.Router());
const db = require("./db");
const { RunStepsPage } = require("openai/resources/beta/threads/runs/steps");

const outboundCallController = async (req, res) => {
  res.sendStatus(200); // Play nice and respond to webhook
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

const inboundCallController = async (req, res) => {
  console.log("START!");
  res.sendStatus(200); // Play nice and respond to webhook
  const event = req.body;
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
      // Speak the OpenAI-generated response back to the caller
      await call.speak({
        payload: "Hi!, How are you, Susano? Welcome to YODAN.",
        voice: "female",
        language: "en-US",
      });
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

router.route("/outbound").post(outboundCallController);

router.route("/inbound").post(inboundCallController);

router.route("/test").get((req, res) => {
  res.send("Test");
});
