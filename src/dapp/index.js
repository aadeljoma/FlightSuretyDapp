import DOM from "./dom";
import Contract from "./contract";
import "./flightsurety.css";

(async () => {
  let result = null;

  let contract = new Contract("localhost", () => {
    // Read transaction
    contract.isOperational((error, result) => {
      console.log(error, result);
      display("Operational Status", "Check if contract is operational", [
        { label: "Operational Status", error: error, value: result }
      ]);
    });

    // User-submitted transaction
    DOM.elid("submit-oracle").addEventListener("click", () => {
      let flightCode = DOM.elid("flight-number").value;
      let destination = DOM.elid("oracle-destination").value;
      // Write transaction
      contract.fetchFlightStatus(flightCode, destination, (error, result) => {
        console.log(`Fetch Flight Status ${result}`);
      });
    });

    DOM.elid("register-flight").addEventListener("click", async () => {
      let flightCode = DOM.elid("register-flight-code").value;
      let price = DOM.elid("register-flight-price").value;
      let departure = DOM.elid("register-flight-departure").value;
      let destination = DOM.elid("register-flight-destination").value;

      contract.registerFlight(
        flightCode,
        price,
        departure,
        destination,
        (error, result) => {
          console.log(error, result);
        }
      );
    });

    DOM.elid("buy-insurance").addEventListener("click", async () => {
      let flightCode = DOM.elid("insurance-flight-code").value;
      let price = DOM.elid("insurance-flight-price").value;
      let destination = DOM.elid("insurance-flight-destination").value;

      contract.buyInsurance(flightCode, destination, price, (error, result) => {
        console.log(error, result);
      });
    });
  });
})();

function display(title, description, results) {
  let displayDiv = DOM.elid("display-wrapper");
  let section = DOM.section();
  section.appendChild(DOM.h2(title));
  section.appendChild(DOM.h5(description));
  results.map(result => {
    let row = section.appendChild(DOM.div({ className: "row" }));
    row.appendChild(DOM.div({ className: "col-sm-4 field" }, result.label));
    row.appendChild(
      DOM.div(
        { className: "col-sm-8 field-value" },
        result.error ? String(result.error) : String(result.value)
      )
    );
    section.appendChild(row);
  });
  displayDiv.append(section);
}
