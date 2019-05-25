var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic =
  "armed damp palace forward this verify debate survey doctor tide throw material";

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 7545,
      network_id: "*"
    },

    ganache: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "http://127.0.0.1:7545/"), 0, 100;
      },
      network_id: "*"
    }
  },
  compilers: {
    solc: {
      version: "0.4.25"
    }
  }
};
