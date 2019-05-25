const Test = require("../config/testConfig.js");

contract("Oracles", async accounts => {
  const TEST_ORACLES_COUNT = 20;
  const STATUS_CODE_ON_TIME = 10;
  let config;

  before("setup contract", async () => {
    config = await Test.Config(accounts);

    await config.flightSuretyData.authorizeCaller(
      config.flightSuretyApp.address
    );
  });

  it("can register oracles", async () => {
    let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();

    for (let a = 1; a < TEST_ORACLES_COUNT; a++) {
      try {
        await config.flightSuretyApp.registerOracle({
          from: accounts[a],
          value: fee
        });
      } catch (error) {
        console.log(error.toString());
      }

      let result = await config.flightSuretyApp.getMyIndexes.call({
        from: accounts[a]
      });
      console.log(
        `Oracle Registered: ${result[0]}, ${result[1]}, ${result[2]}`
      );
    }
  });

  it("can request flight status", async () => {
    const MINIMUM_FUND = web3.utils.toWei("10", "ether");
    const price = web3.utils.toWei("0.5", "ether");
    const flightCode = "MS696";
    const timestamp = (Date.now() / 1000) | 0;
    const departure = "DUBAI";
    const destination = "LONDON";

    try {
      await config.flightSuretyApp.provideFund({
        from: config.firstAirline,
        value: MINIMUM_FUND
      });
    } catch (error) {
      console.log(error.toString());
    }

    try {
      await config.flightSuretyApp.registerFlight(
        flightCode,
        timestamp,
        price,
        departure,
        destination,
        { from: config.firstAirline }
      );
    } catch (error) {
      console.log(error.toString());
    }

    try {
      await config.flightSuretyApp.fetchFlightStatus(
        flightCode,
        destination,
        timestamp
      );
    } catch (error) {
      console.log(error.toString());
    }

    // Since the Index assigned to each test account is opaque by design
    // loop through all the accounts and for each account, all its Indexes (indices?)
    // and submit a response. The contract will reject a submission if it was
    // not requested so while sub-optimal, it's a good test of that feature
    for (let a = 1; a < TEST_ORACLES_COUNT; a++) {
      // Get oracle information
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({
        from: accounts[a]
      });
      for (let idx = 0; idx < 3; idx++) {
        try {
          // Submit a response...it will only be accepted if there is an Index match
          await config.flightSuretyApp.submitOracleResponse(
            oracleIndexes[idx],
            flightCode,
            destination,
            timestamp,
            STATUS_CODE_ON_TIME,
            { from: accounts[a] }
          );
        } catch (e) {
        }
      }
    }
  });
});
