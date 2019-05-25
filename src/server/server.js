import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

import { flightController } from "./app/flight/flight.controller";
import { oracleController } from "./app/oracle/oracle.controller";
import flightRoute from "./app/flight/flight.route";

//console.log(flightContoller.init());

const app = express();

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// parse application/json
app.use(bodyParser.json());

const corsOptions = {
  origin: "*",
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};
app.use(cors(corsOptions));

app.get("/", (req, res) => {
  res.send({
    message: "An API for use with your Dapp!"
  });
});

(() => {
  flightRoute(app);
  flightController.init();
  oracleController.init();
})();

export default app;
