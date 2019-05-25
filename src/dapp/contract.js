import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from "./config.json";
import Web3 from "web3";

export default class Contract {
  constructor(network, callback) {

    let config = Config[network];
    this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
    this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi,config.appAddress);
    this.flightSuretyData = new this.web3.eth.Contract(FlightSuretyData.abi,config.dataAddress);
    this.initialize(callback);
    this.owner = null;
    this.firstAirline = null;
    this.airlines = [];
    this.flights = [];
    this.passengers = [];
  }

  async initialize(callback) {
    let accounts = await this.web3.eth.getAccounts();
      this.owner = accounts[0];
      this.firstAirline = accounts[1];

      let counter = 1;

      while (this.airlines.length < 5) {
        this.airlines.push(accounts[counter++]);
      }

      while (this.passengers.length < 5) {
        this.passengers.push(accounts[counter++]);
      }

      callback();
  }

  isOperational(callback) {
    let self = this;
    self.flightSuretyData.methods
      .isOperational()
      .call({ from: self.owner }, callback);
  }

  fetchFlightStatus(flightCode, destination, callback) {
    let self = this;
    const timestamp = Math.floor(Date.now() / 1000);

    self.flightSuretyApp.methods
      .fetchFlightStatus(flightCode, destination, timestamp)
      .send({ from: self.firstAirline }, (error, result) => {
        callback(error, result);
      });
  }

  registerFlight(flightCode, price, departure, destination, callback) {
    let self = this;
    const timestamp = Math.floor(Date.now() / 1000);
    const value = this.web3.utils.toWei(price.toString(), "ether");

    self.flightSuretyApp.methods.registerFlight(
      flightCode,
      timestamp,
      value,
      departure,
      destination,
      { from: self.firstAirline },
      callback
    );
  }

  buyInsurance(flightCode, destination, price, callback) {
    let self = this;
    const timestamp = Math.floor(Date.now() / 1000);
    const value = this.web3.utils.toWei(price.toString(), "ether");

    self.flightSuretyApp.methods.buyInsurance(
      flightCode,
      timestamp,
      destination,
      {
        from: self.firstAirline,
        value: value
      },
      callback
    );
  }

  withdraw(callback) {
    self.flightSuretyApp.methods
      .withdraw()
      .send({ from: self.firstAirline }, callback);
  }
}
