// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PaymentManager is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint32 public constant MAX_PAYERS = 100;
    bytes32 private constant GROUP_ID_DOMAIN = keccak256("arcaa.payment-group.v1");

    enum GroupStatus {
        Unknown,
        Created,
        Completed,
        Cancelled
    }

    struct Group {
        address creator;
        address receiver;
        uint256 totalAmount;
        uint256 perPaymentAmount;
        uint256 paidAmount;
        uint32 maxPayers;
        uint32 paidCount;
        GroupStatus status;
    }

    struct GroupPayment {
        uint256 amount;
        uint64 paidAt;
        bool paid;
    }

    IERC20 public immutable usdc;

    mapping(bytes32 groupId => Group group) private _groups;
    mapping(bytes32 groupId => mapping(address payer => GroupPayment payment)) private _groupPayments;
    mapping(bytes32 groupId => address[] payers) private _groupPayers;

    event GroupCreated(
        bytes32 indexed groupId,
        address indexed creator,
        address indexed receiver,
        uint256 totalAmount,
        uint256 perPaymentAmount,
        uint32 maxPayers
    );

    event GroupPaid(
        bytes32 indexed groupId,
        address indexed payer,
        address indexed receiver,
        uint256 amount,
        uint64 paidAt,
        uint32 paidCount
    );

    event GroupCancelled(bytes32 indexed groupId, address indexed canceller);

    error InvalidUSDC();
    error InvalidGroupId();
    error InvalidReceiver();
    error InvalidAmount();
    error InvalidPayerCount();
    error AmountNotDivisible();
    error GroupAlreadyExists();
    error GroupNotFound();
    error GroupNotPayable();
    error AlreadyPaid();
    error NotAuthorized();

    constructor(address usdc_) {
        if (usdc_ == address(0)) revert InvalidUSDC();
        usdc = IERC20(usdc_);
    }

    function computeGroupId(address creator, bytes32 salt) public view returns (bytes32) {
        return keccak256(abi.encode(GROUP_ID_DOMAIN, block.chainid, address(this), creator, salt));
    }

    function createGroup(
        bytes32 salt,
        address receiver,
        uint256 totalAmount,
        uint32 maxPayers
    ) external returns (bytes32 groupId) {
        if (salt == bytes32(0)) revert InvalidGroupId();
        if (receiver == address(0)) revert InvalidReceiver();
        if (totalAmount == 0) revert InvalidAmount();
        if (maxPayers == 0 || maxPayers > MAX_PAYERS) revert InvalidPayerCount();
        if (totalAmount % maxPayers != 0) revert AmountNotDivisible();

        groupId = computeGroupId(msg.sender, salt);
        if (_groups[groupId].status != GroupStatus.Unknown) {
            revert GroupAlreadyExists();
        }

        uint256 perPaymentAmount = totalAmount / maxPayers;
        if (perPaymentAmount == 0) revert InvalidAmount();

        _groups[groupId] = Group({
            creator: msg.sender,
            receiver: receiver,
            totalAmount: totalAmount,
            perPaymentAmount: perPaymentAmount,
            paidAmount: 0,
            maxPayers: maxPayers,
            paidCount: 0,
            status: GroupStatus.Created
        });

        emit GroupCreated(groupId, msg.sender, receiver, totalAmount, perPaymentAmount, maxPayers);

        return groupId;
    }

    function payGroup(bytes32 groupId) external nonReentrant {
        Group storage group = _groups[groupId];
        if (group.status == GroupStatus.Unknown) revert GroupNotFound();
        if (group.status != GroupStatus.Created) revert GroupNotPayable();
        if (group.paidCount >= group.maxPayers) revert GroupNotPayable();
        if (_groupPayments[groupId][msg.sender].paid) revert AlreadyPaid();

        uint256 amount = group.perPaymentAmount;
        group.paidCount += 1;
        group.paidAmount += amount;

        if (group.paidCount == group.maxPayers) {
            group.status = GroupStatus.Completed;
        }

        _groupPayments[groupId][msg.sender] = GroupPayment({
            amount: amount,
            paidAt: uint64(block.timestamp),
            paid: true
        });
        _groupPayers[groupId].push(msg.sender);

        usdc.safeTransferFrom(msg.sender, group.receiver, amount);

        emit GroupPaid(groupId, msg.sender, group.receiver, amount, uint64(block.timestamp), group.paidCount);
    }

    function cancelGroup(bytes32 groupId) external {
        Group storage group = _groups[groupId];
        if (group.status == GroupStatus.Unknown) revert GroupNotFound();
        if (group.status != GroupStatus.Created) revert GroupNotPayable();
        if (msg.sender != group.creator && msg.sender != group.receiver) {
            revert NotAuthorized();
        }

        group.status = GroupStatus.Cancelled;

        emit GroupCancelled(groupId, msg.sender);
    }

    function getGroup(bytes32 groupId) external view returns (Group memory) {
        return _groups[groupId];
    }

    function getGroupPayment(bytes32 groupId, address payer) external view returns (GroupPayment memory) {
        return _groupPayments[groupId][payer];
    }

    function getGroupPayers(bytes32 groupId) external view returns (address[] memory) {
        return _groupPayers[groupId];
    }
}
