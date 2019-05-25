import { config } from "../../config/config-web3";

const data = config.flightSuretyData;
const app = config.flightSuretyApp;
const oraclesCount = config.oraclesCount;
const accountsCount = config.accountsCount;

const statusCodes = [0, 10, 20, 30, 40, 50];

let oracles = [];
let accounts = [];

export const oracleController = {
  init: async () => {
    accounts = await config.accounts;
    
    try {
      await data.methods
        .authorizeCaller(app._address)
        .send({ from: accounts[0] });
    } catch (error) {
      console.log(`authorizeCaller ${error.toString()}`);
    }

    app.events.OracleReport({}, (error, event) => {
      if (error) console.log(error);
      else {
        console.log(`oracle report event triggered: ${event.returnValues}`);
      }
    });

    app.events.OracleRequest({}, async (error, event) => {
      if (error) console.log(error);
      else {
        const { flightCode, destination, timestamp } = event.returnValues;

        console.log(
          `oracleRequest event triggered: flightCode: ${flightCode}, destination: ${destination}, timestamp: ${timestamp}`
        );

        await oracleController.submitOracleResponse(
          flightCode,
          destination,
          timestamp
        );
      }
    });

    oracleController.registerOracle();
  },

  registerOracle: async () => {
    const fees = await app.methods.REGISTRATION_FEE().call();
    accounts = await config.accounts;

    try {
      for (let i = accountsCount - oraclesCount; i < oraclesCount; i += 1) {
        await app.methods.registerOracle().send({
          from: accounts[i],
          value: fees,
          gas: 3000000
        });

        oracles.push(account[i]);
      }
    } catch (error) {
      console.log(error.toString());
    }
  },

  submitOracleResponse: async (flightCode, destination, timestamp) => {
    for (let i = 0; i < oracles.length; i += 1) {
      const statusCode = Math.floor(Math.random() * statusCodes.length);
      let indexes = await app.methods.getMyIndexes().call({
        from: oracles[i]
      });

      for (let index = 0; index < indexes.length; index += 1) {
        try {
          await app.methods
            .submitOracleResponse(
              index,
              flightCode,
              destination,
              timestamp,
              statusCode
            )
            .send({
              from: oracles[i],
              gas: 3000000
            });
        } catch (error) {
          console.log(error.toString());
        }
      }
    }
  }
};
