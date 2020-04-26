const http = require('http');
const bodyParser = require('body-parser');
const Datastore = require('nedb');
const express = require('express');
const cors = require('cors');
const fs = require('fs');

const striptags = require("striptags");


const app = express();