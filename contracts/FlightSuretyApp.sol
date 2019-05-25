pragma solidity ^0.4.25;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";
//import "../contracts/FlightSuretyData.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)
    
    FlightSuretyData flightSuretyData;
    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    uint256 public constant MINIMUM_FUNDING = 10 ether;
    uint256 private constant MAX_INSURANCE_PAYMENT = 1 ether;

    uint256 private constant STARALLIANCE = 4;
    mapping(address => address[]) public votesOfAirlines;

    address private contractOwner;          // Account used to deploy contract
    

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    event WithdrawRequest(address recipient);

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
        require(flightSuretyData.isOperational(), "Contract is currently not operational");
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

    /**
    * @dev Modifier that requires the "Airline" not to be registered
    */
    modifier requireAirlineToBeNotRegistered(address _account)
    {
        require(!flightSuretyData.isAirlineRegistered(_account), "Airline is already registered.");
        _;
    }

    /**
    * @dev Modifier that requires the "Sender" to be an airline that provided fund.
    */
    modifier requireProvidedFund()
    {
        require(flightSuretyData.isAirlineProvidedFund(msg.sender), "The Airline did not provide a funding.");
        _;
    }

    modifier requireMinimumFundProvided() {
        require(msg.value >= MINIMUM_FUNDING, "The minimum funding is 10 ether");
        _;
    }

    modifier requireIsPaidEnough(uint _price) {
        require(msg.value >= _price, "Sent value must cover the price");
        _;
    }

    modifier requireValueCheck(uint _price) {
        _;
        uint amountToReturn = msg.value - _price;
        msg.sender.transfer(amountToReturn);
    }

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/


    /**
    * @dev Contract constructor
    *
    */
    constructor(address dataContract) public {
        contractOwner = msg.sender;
        flightSuretyData = FlightSuretyData(dataContract);
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

  
   /**
    * @dev Add an airline to the registration queue
    *
    */   
    function registerAirline(address _account) external requireIsOperational 
    requireAirlineToBeNotRegistered(_account)
    requireProvidedFund
    {
        if (flightSuretyData.getRegisteredAirlinesCount() < STARALLIANCE){
            flightSuretyData.registerAirline(_account, msg.sender);
        } else {
            bool isDuplicate = false;
            for(uint c=0; c < votesOfAirlines[_account].length; c++) {
                if (votesOfAirlines[_account][c] == msg.sender) {
                    isDuplicate = true;
                    break;
                }
            }
            require(!isDuplicate, "Caller has already called this function.");
            votesOfAirlines[_account].push(msg.sender);
            uint votes = votesOfAirlines[_account].length;
            uint256 M = flightSuretyData.getRegisteredAirlinesCount().div(2);
            

            if (votes > M) {
                votesOfAirlines[_account] = new address[](0);
                flightSuretyData.registerAirline(_account, msg.sender);
            }
        }
    }

    function provideFund() external payable requireMinimumFundProvided requireIsOperational{
        flightSuretyData.fund.value(msg.value)(msg.sender);
    }

    function getFlightKey(string _flightCode, string _destination, uint _timestamp) public pure returns(bytes32) {
      return keccak256(abi.encodePacked(_flightCode, _destination, _timestamp));
    }


   /**
    * @dev Register a future flight for insuring.
    *
    */  
    function registerFlight(string _flightCode, uint _timestamp, uint _price, string _departure, string _destination) external
    requireIsOperational
    requireProvidedFund 
    {
        flightSuretyData.registerFlight(
            _flightCode,        
            _timestamp,
            _price,
            _departure,
            _destination,
            msg.sender
        );
    }

    function buyInsurance(string _flight, uint _timestamp, string _destination) public payable
    requireIsOperational
    requireIsPaidEnough(MAX_INSURANCE_PAYMENT)
    requireValueCheck(MAX_INSURANCE_PAYMENT) 
    {

      bytes32 flightKey = getFlightKey(_flight, _destination, _timestamp);

      flightSuretyData.buy(flightKey, msg.value, msg.sender);
    }

    function withdraw() public requireIsOperational
    {
        flightSuretyData.pay(msg.sender);
    }


    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus(string _flight, string _destination, uint _timestamp) public
    {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(abi.encodePacked(_flight, _timestamp, _destination));
        oracleResponses[key] = ResponseInfo({
                                                requester: msg.sender,
                                                isOpen: true
                                            });

        emit OracleRequest(index, _flight, _destination, _timestamp);
    }

// region ORACLE MANAGEMENT
// Incremented to add pseudo-randomness at various points
  uint8 private nonce = 0;

  // Fee to be paid when registering oracle
  uint256 public constant REGISTRATION_FEE = 1 ether;

  // Number of oracles that must respond for valid status
  uint8 private constant MIN_RESPONSES = 3;

  struct Oracle {
    bool isRegistered;
    uint8[3] indexes;
  }

  // Track all registered oracles
  mapping(address => Oracle) private oracles;

  // Model for responses from oracles
  struct ResponseInfo {
    address requester;                              
    bool isOpen;                                    
    mapping(uint8 => address[]) responses;
  }

  // Track all oracle responses
  // Key = hash(flight, destination, timestamp)
  mapping(bytes32 => ResponseInfo) public oracleResponses;

  event OracleRegistered(uint8[3] indexes);
  // Event fired each time an oracle submits a response
  event OracleReport(string flightCode, string destination, uint timestamp, uint8 status);
  // Event fired when number of identical responses reaches the threshold: response is accepted and is processed
  event FlightStatusInfo(string flightCode, string destination, uint timestamp, uint8 status);

  // Event fired when flight status request is submitted
  // Oracles track this and if they have a matching index
  // they fetch data and submit a response
  event OracleRequest(uint8 index, string flightCode, string destination, uint timestamp);


  // Register an oracle with the contract
  function registerOracle() external payable {
    // Require registration fee
    require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

    uint8[3] memory indexes = generateIndexes(msg.sender);

    oracles[msg.sender] = Oracle({
      isRegistered: true,
      indexes: indexes
    });
    emit OracleRegistered(indexes);
  }

  function getMyIndexes() external view returns(uint8[3]) {
    require(oracles[msg.sender].isRegistered, "Not registered as an oracle");

    return oracles[msg.sender].indexes;
  }

  // Called by oracle when a response is available to an outstanding request
  // For the response to be accepted, there must be a pending request that is open
  // and matches one of the three Indexes randomly assigned to the oracle at the
  // time of registration (i.e. uninvited oracles are not welcome)
  function submitOracleResponse(uint8 _index, string _flightCode, string _destination, uint _timestamp, uint8 _status) external {
    
    require((oracles[msg.sender].indexes[0] == _index) || 
            (oracles[msg.sender].indexes[1] == _index) || 
            (oracles[msg.sender].indexes[2] == _index),
            "Index does not match oracle request"
    );

    bytes32 key = getFlightKey(_flightCode, _destination, _timestamp);
    require(oracleResponses[key].isOpen,"Flight or timestamp do not match oracle request.");

    oracleResponses[key].responses[_status].push(msg.sender);
    emit OracleReport(_flightCode, _destination, _timestamp, _status);

    /* Information isn't considered verified until at least
    MIN_RESPONSES oracles respond with the *** same *** information
    */
    if (oracleResponses[key].responses[_status].length == MIN_RESPONSES) {
      // close responseInfo
      oracleResponses[key].isOpen = false;
      emit FlightStatusInfo(_flightCode, _destination, _timestamp, _status);
      // Handle flight status as appropriate
      flightSuretyData.processFlightStatus(key, _status);
    }
  }

  // Returns array of three non-duplicating integers from 0-9
  function generateIndexes(address _account) internal returns(uint8[3]) {
    
    uint8[3] memory indexes;
    indexes[0] = getRandomIndex(_account);

    indexes[1] = indexes[0];
    while (indexes[1] == indexes[0]) {
      indexes[1] = getRandomIndex(_account);
    }

    indexes[2] = indexes[1];
    while ((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
      indexes[2] = getRandomIndex(_account);
    }

    return indexes;
  }

  // Returns array of three non-duplicating integers from 0-9
  function getRandomIndex(address _account) internal returns (uint8) {
    uint8 maxValue = 10;

    // Pseudo random number...the incrementing nonce adds variation
    uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), _account))) % maxValue);

    if (nonce > 250) {
      nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
    }

    return random;
  } 
// endregion
}

// FlightSuretyData Interface contract
contract FlightSuretyData {
    function isOperational() public view returns(bool);
    function isAirlineRegistered(address account) external view returns(bool);
    function isAirlineProvidedFund(address account) external view returns(bool);
    function getRegisteredAirlinesCount() external view returns(uint);
    function registerAirline(address _account, address _sender) external;
    function fund(address _airline) public payable;
    function registerFlight(string _flightCode, uint _timestamp, uint _price, string _departure, string _destination, address _airline) external;
    function buy(bytes32 flightKey, uint amount, address originAddress) external payable;
    function creditInsurees(bytes32 flightKey) internal;
    function pay(address originAddress) external;
    function processFlightStatus(bytes32 flightKey, uint8 flightStatus) external;
}
