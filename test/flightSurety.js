const Test = require("../config/testConfig.js");

contract("Flight Surety Tests", async accounts => {
  var config;

  before("setup contract", async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(
      config.flightSuretyApp.address
    );
  });

  describe("Contracts Operational Status", () => {
    it("Contract has correct initial isOperational() value", async () => {
      // Get operating status
      let status = await config.flightSuretyData.operational.call();

      assert.equal(status, true, "Incorrect initial operating status value");
    });

    it("Contract can block access to setOperatingStatus() for non-Contract Owner account", async function() {
      // Ensure that access is denied for non-Contract Owner account
      let accessDenied = false;

      try {
        await config.flightSuretyData.setOperatingStatus(false, {
          from: config.testAddresses[2]
        });
      } catch (e) {
        accessDenied = true;
      }

      assert.equal(
        accessDenied,
        true,
        "Access not restricted to Contract Owner"
      );
    });

    it("Contract can block access to functions using requireIsOperational when operating status is false", async () => {
      await config.flightSuretyData.setOperatingStatus(false);

      let reverted = false;

      try {
        await config.flightSurety.setTestingMode(true);
      } catch (e) {
        reverted = true;
      }

      assert.equal(
        reverted,
        true,
        "Access not blocked by requireIsOperational"
      );

      // Set it back for other tests to work
      await config.flightSuretyData.setOperatingStatus(true);
    });
  });

  describe("Airlines registration", () => {
    const MINIMUM_FUNDING = web3.utils.toWei("10", "ether");

    const secondAirline = accounts[7];
    const thirdAirline = accounts[8];
    const forthAirline = accounts[9];
    const fifthAirline = accounts[10];

    it("First airline is registered when contract is deployed", async () => {
      const isAirlineRegistered = await config.flightSuretyData.isAirlineRegistered.call(
        config.firstAirline
      );

      assert.equal(isAirlineRegistered, true, "First airline is not registered when contract is deployed");

    });

    it("Airline cannot register another airline before providing fund", async () => {
      try {
        await config.flightSuretyApp.registerAirline(secondAirline, {
          from: config.firstAirline
        });
      } catch (error) {}

      const isAirlineRegistered = await config.flightSuretyData.isAirlineRegistered(secondAirline);

      assert.equal(isAirlineRegistered, false, "Airline should not be able to register another airline without providing fund");
    });

    it("Airline can be registered, but does not participate in contract until it submits funding of 10 ether", async () => {
      try {
        await config.flightSuretyApp.provideFund({from: config.firstAirline, value: MINIMUM_FUNDING});
      } catch (error) {
        console.log(error.toString());
      }
      
      try {
        await config.flightSuretyApp.registerAirline(secondAirline, {from: config.firstAirline});
      } catch (error) {
        console.log(error.toString());
      }

      const isSecondAirlineRegistered = await config.flightSuretyData.isAirlineRegistered(secondAirline);

      assert.equal(isSecondAirlineRegistered, true, "Airline should not be able to register another airline without providing fund");

    });

    it("Only existing airline may register a new airline until there are at least four airlines registered", async () => {

      try {
        await config.flightSuretyApp.provideFund({from:secondAirline, value: MINIMUM_FUNDING});
      } catch (error) {
        console.log(error.toString());
      }

      try {
        await config.flightSuretyApp.registerAirline(thirdAirline, {from: secondAirline});
      } catch (error) {
        console.log(error.toString());
      }

      try {
        await config.flightSuretyApp.provideFund({from: thirdAirline, value: MINIMUM_FUNDING});
      } catch (error) {
        console.log(error.toString());
      }

      try {
        await config.flightSuretyApp.registerAirline(forthAirline, {from: thirdAirline});
      } catch (error) {
        console.log(error.toString());
      }

      try {
        await config.flightSuretyApp.provideFund({from: forthAirline, value: MINIMUM_FUNDING});
      } catch (error) {
        console.log(error.toString());
      }

      try {
        await config.flightSuretyApp.registerAirline(fifthAirline, {from: forthAirline});
      } catch (error) {
        console.log(error.toString());
      }

      try {
        await config.flightSuretyApp.provideFund({from: fifthAirline, value: MINIMUM_FUNDING});
      } catch (error) {
        console.log(error.toString());
      }

      const is2thAirlineRegistered = await config.flightSuretyData.isAirlineRegistered.call(secondAirline);

      const is3thAirlineRegistered = await config.flightSuretyData.isAirlineRegistered.call(thirdAirline);

      const is4thAirlineRegistered = await config.flightSuretyData.isAirlineRegistered.call(forthAirline);

      const is5thAirlineRegistered = await config.flightSuretyData.isAirlineRegistered.call(fifthAirline);

      assert.equal(is2thAirlineRegistered, true, "Second airline should be able to register");

      assert.equal(is3thAirlineRegistered, true, "Third airline should be able to register");

      assert.equal(is4thAirlineRegistered, true, "Forth airline should be able to register");

      assert.equal(is5thAirlineRegistered, false, "Fifth airline should not be able to register");

    });

    it("Registration of fifth and subsequent airlines requires multi-party consensus of 50% of registered airlines", async () => {
      try {
        await config.flightSuretyApp.registerAirline(fifthAirline, {from: secondAirline});
      } catch (error) {
        console.log(error.toString());
      }

      try {
        await config.flightSuretyApp.registerAirline(fifthAirline, {from: thirdAirline});
      } catch (error) {
        console.log(error.toString());
      }

      const is5thAirlineRegistered = await config.flightSuretyData.isAirlineRegistered.call(fifthAirline);
      assert.equal(is5thAirlineRegistered, true, "Fifth airline should be able to register");
    });
  });


  describe("flight registration", () => {
    const departure = "CAI";
    const destination = "PAR";
    const flightCode = "BE287";
    const timestamp = (Date.now() / 1000) | 0;

    const price = web3.utils.toWei("0.3", "ether");

    it("airline Can register a flight", async () => {
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

      const flightKey = await config.flightSuretyApp.getFlightKey(flightCode, destination, timestamp);

      const isFlightRegistered = await config.flightSuretyData.isFlightRegistered.call(
        flightKey
      );

      assert.equal(isFlightRegistered, true, "Flight not registered");
    });
  });

  describe("buy flight insurance", () => {
    const destination = "PAR";
    const flightCode = "BE287";
    const timestamp = (Date.now() / 1000) | 0;
    const insurancePrice = web3.utils.toWei("1", "ether");
    const passenger = accounts[8];

    it("passenger can buy a flight insurance", async () => {
      try {
        await config.flightSuretyApp.buyInsurance(
          flightCode,
          timestamp,
          destination,
          {
            from: passenger,
            value: insurancePrice
          }
        );
      } catch (error) {
        console.log(error.toString());
      }

      const flightKey = await config.flightSuretyApp.getFlightKey(flightCode, destination, timestamp);

      const amount = await config.flightSuretyData.getPassengerPaidAmount.call(
        flightKey,
        passenger
      );
      assert.equal(
        amount,
        insurancePrice,
        "Passenger should be able to buy insurance correctly"
      );
    });

    it("withdraw credit", async () => {
      const balanceBefore = await web3.eth.getBalance(config.firstAirline);
      
      try {
        await config.flightSuretyApp.withdraw({ from: config.firstAirline });
      } catch (error) {
        console.log(error.toString());
      }

      const balanceAfter = await web3.eth.getBalance(config.firstAirline);

      assert(+balanceBefore < +balanceAfter, "Airline withdrawal failed");
    });
  });


});
