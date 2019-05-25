const flightController = require('./flight.controller');

module.exports = app => {
  // Retrieve all Flights
  app.get("/flights", async (req, res) => {
    const flights = await flightController.getFlights().flights;
    console.log(await flightController.getFlights());
    res.send(flights);
  });
};
