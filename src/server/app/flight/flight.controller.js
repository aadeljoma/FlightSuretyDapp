import { config } from "../../config/config-web3";
const data = config.flightSuretyData;

export const flightController = {
  init: async () => {
    data.events.FlightRegistered({}, (error, event) => {
      if (error) console.log(error);
      else {
        const { flightKey } = event.returnValues;
        console.log(`FlightRegistered flightKey ${flightKey}`);
        getFlights();
      }
    });

    data.events.FlightStatusUpdated({}, (error, event) => {
      if (error) console.log(error);
      else {
        const { flightKey, status } = event.returnValues;
        console.log(
          `FlightStatusUpdated: flightKey ${flightKey} status ${status}`
        );
        getFlights();
      }
    });

    data.events.PassengerCredited({}, (error, event) => {
      if (error) console.log(error);
      else {
        const { passenger, amount } = event.returnValues;
        console.log(
          `PassengerCredited: passenger ${passenger} amount ${amount}`
        );
      }
    });

    data.events.Withdrawal({}, (error, event) => {
      if (error) console.log(error);
      else {
        const { recipient, amount } = event.returnValues;
        console.log(
          `Withdrawal: recipient ${recipient} amount ${amount}`
        );
      }
    });
  },
  getFlights: async () => {
    let flights = [],
    flightKey = null,
    flight = null;

    const flightsCount = await data.methods.getRegisteredFlightsCount().call();

    for (let i = 0; i < flightsCount; i += 1) {
      flightKey = await data.flightKeys(i).call();
      flight = await data.flights(flightKey).call();

      if (flight.status === 0) {
        flights.push(flight);
      }
    }

    return flights;
  }
};
