require('dotenv').config()

const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({extended: true}));

const callControlPath = '/call-control';
const callControl = require('./callControl');
app.use(callControlPath, callControl);

app.listen(process.env.PORT);
console.log(`Server listening on port ${process.env.PORT}`);
