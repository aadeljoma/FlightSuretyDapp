pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner; // Account used to deploy contract
   
    bool public operational = true; // Blocks all state changes throughout the contract if false

    mapping(address => bool) public authorizedCallers; // List addresses allowed to call this contract

    uint256 public registeredAirlinesCount;
    uint256 public registeredFlightsCount;

    struct Airline {
        bool isRegistered;
        bool isFunded;
    }

    mapping(address => Airline) public airlines; 

    struct Flight {
        bool isRegistered;
        string flightCode;
        uint8 flightStatus;
        uint timestamp;
        string destination;
        uint price;
        string departureTime;
        address airline;
        mapping(address => uint) insurances;
    }

    mapping(bytes32 => Flight) public flights;

    address[] internal passengers;
    bytes32[] public flightKeys;
    mapping(address => uint) public withdrawals;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    event AirlineRegistered(address airline, address origin);
    event AirlineProvidedFund(address airline);
    event FlightRegistered(bytes32 flightKey);
    event FlightStatusUpdated(bytes32 flightKey, uint8 status);
    event PassengerCredited(address passenger, uint amount);
    event Withdrawal(address recipient, uint amount);


    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor(address _firstAirline) public 
    {
        contractOwner = msg.sender;
        airlines[_firstAirline] = Airline({
            isRegistered: true,
            isFunded: false
        });
        
        registeredAirlinesCount = 1;

    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() 
    {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier requireIsCallerAuthorized() {
        require(authorizedCallers[msg.sender] == true, "Caller is not authorized");
        _;
    }

    /* do not process a flight more than once,
    which could e.g result in the passengers being credited their insurance amount twice.
    */
    modifier requireIsNotYetProcessed(bytes32 flightKey) {
        require(flights[flightKey].flightStatus == 0, "This flight has already been processed");
        _;
    }

    modifier requireIsFlightRegistered(bytes32 _flightKey) {
        require(flights[_flightKey].isRegistered, "This flight is not exist");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function setOperatingStatus(bool mode) external requireContractOwner {
        require(mode != operational, "Contract already in the requested state");
        operational = mode;
    }

    function isOperational() external view returns(bool) {
        return operational;
    }

    /**
    * @dev
    *
    * Function to authorize addresses (especially the App contract!) to call functions from flighSuretyData contract
    */
    function authorizeCaller(address callerAddress) external requireContractOwner requireIsOperational
    {
        authorizedCallers[callerAddress] = true;
    }

    function isAirlineRegistered(address account) external view returns(bool)
    {
        require(account != address(0), "'account' must be a valid address.");
        return airlines[account].isRegistered;
    }

    function isFlightRegistered(bytes32 _flightKey) external view returns(bool) {
        return flights[_flightKey].isRegistered;
    }

    function isAirlineProvidedFund(address account) external view returns(bool)
    {
        require(account != address(0), "'account' must be a valid address.");
        return airlines[account].isFunded;
    }

    function getRegisteredAirlinesCount() external view returns(uint) {
        return registeredAirlinesCount;
    }

    function getRegisteredFlightsCount() external view returns(uint) {
        return flightKeys.length;
        }

    function getPassengerPaidAmount(bytes32 _flightKey, address _passenger) public view returns(uint) {
        return flights[_flightKey].insurances[_passenger];
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */   
    function registerAirline(address _account,address _sender) external requireIsOperational requireIsCallerAuthorized
    {
        require(!airlines[_account].isRegistered, "Airline is already registered.");

        airlines[_account] = Airline({
            isRegistered: true,
            isFunded: false
        });

        registeredAirlinesCount += 1;

        emit AirlineRegistered(_account, _sender);
    }

    /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */   
    function fund(address _airline) public payable requireIsOperational
    {
        airlines[_airline].isFunded = true;
        emit AirlineProvidedFund(_airline);
    }


    /**
    * @dev Register a future flight for insuring.
    *
    */  
    function registerFlight(string _flightCode, uint _timestamp, uint _price, string _departure, string _destination, address _airline) external
    requireIsOperational
    requireIsCallerAuthorized
    {
        bytes32 flightKey = getFlightKey(_flightCode, _destination, _timestamp);
        
        flights[flightKey] = Flight({
            isRegistered: true,
            flightCode: _flightCode,
            flightStatus: 0,
            timestamp: _timestamp,
            price: _price,
            destination: _destination,
            departureTime: _departure,
            airline: _airline
        });
      
        flightKeys.push(flightKey);
      
        emit FlightRegistered(flightKey);
    }

   /**
    * @dev Buy insurance for a flight
    *
    */   
    function buy(bytes32 flightKey, uint amount, address originAddress) external payable
    requireIsOperational
    requireIsCallerAuthorized
    requireIsFlightRegistered(flightKey)
    {
        Flight storage flight = flights[flightKey];
        flight.insurances[originAddress] = amount;
        passengers.push(originAddress);
        withdrawals[flight.airline] = flight.price;
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees(bytes32 flightKey) internal
    requireIsOperational
    requireIsFlightRegistered(flightKey)
    {
        // get flight
        Flight storage flight = flights[flightKey];
        // loop over passengers and credit them their insurance amount
        for (uint i = 0; i < passengers.length; i++) {
            withdrawals[passengers[i]] = (flight.insurances[passengers[i]]).add((flight.insurances[passengers[i]]).div(2));
            emit PassengerCredited(passengers[i], flight.insurances[passengers[i]]);
        }
    }
    

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay(address originAddress) external requireIsOperational requireIsCallerAuthorized
    {
        // Check-Effect-Interaction pattern to protect against re entrancy attack
        // Check
        require(withdrawals[originAddress] > 0, "No amount to be transferred to this address");
        // Effect
        uint amount = withdrawals[originAddress];
        withdrawals[originAddress] = 0;
        // Interaction
        originAddress.transfer(amount);
        emit Withdrawal(originAddress, amount);
    }

    function processFlightStatus(bytes32 flightKey, uint8 flightStatus) external
    requireIsFlightRegistered(flightKey)
    requireIsOperational
    requireIsCallerAuthorized
    requireIsNotYetProcessed(flightKey)
    {
        // Check (modifiers)
        Flight storage flight = flights[flightKey];
        // Effect
        flight.flightStatus = flightStatus;
        // Interact
        // 20 = "flight delay due to airline"
        if (flightStatus == 20) {
            creditInsurees(flightKey);
        }
        emit FlightStatusUpdated(flightKey, flightStatus);
    }

    function getFlightKey(string memory flight, string destination, uint timestamp) pure internal returns(bytes32)
    {
        return keccak256(abi.encodePacked(flight, destination, timestamp));
    }

    function fallbackfun() public payable{}

    function() external payable requireIsCallerAuthorized {
        require(msg.data.length == 0);
        fallbackfun();
  }
}

