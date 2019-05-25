import Web3 from "web3";

import contractConfig from '../config.json';

import FlightSuretyData from "../../../build/contracts/FlightSuretyData.json";
import FlightSuretyApp from "../../../build/contracts/FlightSuretyApp.json";

const devConfig = {
  devUrl: contractConfig["localhost"].url,
  dataAddress: contractConfig["localhost"].dataAddress,
  appAddress: contractConfig["localhost"].appAddress
};

const web3 = new Web3(
  new Web3.providers.WebsocketProvider(devConfig.devUrl.replace("http", "ws"))
);

const accounts = web3.eth.getAccounts();
web3.eth.defaultAccount = accounts[0];

export const config = {
  flightSuretyApp: new web3.eth.Contract(
    FlightSuretyApp.abi,
    devConfig.appAddress
  ),
  flightSuretyData: new web3.eth.Contract(
    FlightSuretyData.abi,
    devConfig.dataAddress
  ),
  accounts: accounts,
  oraclesCount: 30,
  accountsCount: 100
};
