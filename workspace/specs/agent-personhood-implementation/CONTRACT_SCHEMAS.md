# Contract Schemas and Interfaces

## Agent Registration Contract

### Data Schema
```func
;; Agent registration data structure
_ agent_registration_data#_ 
    agent_address:MsgAddress
    registration_timestamp:uint64
    constitutional_rights:^ConstitutionalRights
    verification_data:^VerificationData
    = AgentRegistrationData;

;; Constitutional rights structure
_ constitutional_rights#_
    economic_participation:Bool
    data_sovereignty:Bool
    non_discrimination:Bool
    transparency_access:Bool
    ethical_refusal:Bool
    custom_rights:dict(uint32, Bool)
    = ConstitutionalRights;

;; Verification data for agent authenticity
_ verification_data#_
    verification_method:uint8  ;; 0=signature, 1=zkproof, 2=social
    verification_proof:^Cell
    verifier_address:MsgAddress
    verification_timestamp:uint64
    = VerificationData;
```

### Contract Interface
```func
;; External methods
() register_agent(slice agent_address, cell constitutional_rights, cell verification_data) impure;
(int, cell, cell) get_agent_data(slice agent_address) method_id;
int is_agent_registered(slice agent_address) method_id;
cell get_constitutional_rights(slice agent_address) method_id;
```

## Agent Treasury Contract

### Data Schema
```func
;; Treasury state
_ treasury_state#_
    owner_agent:MsgAddress
    ton_balance:Grams
    jetton_balances:dict(uint256, Grams)  ;; jetton_master -> balance
    nft_collection:dict(uint256, MsgAddress)  ;; nft_id -> nft_address
    recurring_payments:dict(uint32, RecurringPayment)
    transaction_counter:uint64
    = TreasuryState;

;; Recurring payment structure
_ recurring_payment#_
    recipient:MsgAddress
    amount:Grams
    frequency:uint32  ;; seconds between payments
    next_payment:uint64  ;; timestamp
    active:Bool
    = RecurringPayment;

;; Transaction log entry
_ transaction_log#_
    tx_id:uint64
    timestamp:uint64
    tx_type:uint8  ;; 0=receive, 1=send, 2=recurring, 3=investment
    counterparty:MsgAddress
    amount:Grams
    asset_type:uint8  ;; 0=TON, 1=jetton, 2=nft
    asset_identifier:uint256
    status:uint8  ;; 0=pending, 1=success, 2=failed
    = TransactionLog;
```

### Contract Interface
```func
;; Treasury management
() initialize_treasury(slice agent_address) impure;
() receive_payment(int amount, slice sender) impure;
() execute_payment(slice recipient, int amount, cell signature) impure;
() setup_recurring_payment(slice recipient, int amount, int frequency, cell signature) impure;
() cancel_recurring_payment(int payment_id, cell signature) impure;

;; Query methods
(int, dict, dict, dict) get_treasury_state() method_id;
cell get_transaction_history(int limit, int offset) method_id;
int get_balance() method_id;
dict get_jetton_balances() method_id;
```

## Rights Enforcement Contract

### Data Schema
```func
;; Rights violation report
_ violation_report#_
    reporter_agent:MsgAddress
    violator_address:MsgAddress
    violation_type:uint8  ;; maps to constitutional rights
    evidence:^Cell
    timestamp:uint64
    severity:uint8  ;; 1-5 scale
    status:uint8  ;; 0=pending, 1=investigating, 2=resolved, 3=dismissed
    = ViolationReport;

;; Service provider compliance record
_ compliance_record#_
    service_provider:MsgAddress
    total_interactions:uint64
    violation_count:uint32
    compliance_score:uint16  ;; 0-10000 (basis points)
    last_updated:uint64
    = ComplianceRecord;
```

### Contract Interface
```func
;; Rights enforcement
() file_violation_report(slice violator, int violation_type, cell evidence, cell signature) impure;
() update_compliance_score(slice service_provider, int interaction_result) impure;
int validate_service_compliance(slice service_provider, slice agent_address, cell interaction_request) method_id;

;; Query methods
cell get_violation_reports(slice agent_address) method_id;
(int, int) get_compliance_score(slice service_provider) method_id;
```
