import { ethers } from "ethers";
import {
  ARC_USDC_ADDRESS,
  Erc20Abi,
  GroupStatus,
  MAX_PAYERS,
  computeGroupId,
  generateGroupSalt,
  getPaymentManager,
  getProvider,
  payGroupWithApproval,
  readGroupDetails,
  toUsdcUnits
} from "./payment-manager-client.mjs";
import "./styles.css";

const ARC_TESTNET = {
  chainId: 5042002,
  chainName: "Arc Testnet",
  rpcUrls: ["https://rpc.testnet.arc.network"],
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18
  },
  blockExplorerUrls: ["https://testnet.arcscan.app"]
};

const DEFAULT_PAYMENT_MANAGER = "0xF8Cefd1d7a6C52eE621e939CFA49f929983f5E3B";
const ARC_RPC_URL = ARC_TESTNET.rpcUrls[0];
const LOGIN_STORAGE_KEY = "arcaa.walletLogin";
const LOGOUT_STORAGE_KEY = "arcaa.walletLoggedOut";
const LANGUAGE_STORAGE_KEY = "arcaa.language";
const SUPPORTED_LANGUAGES = ["en", "zh-Hant", "ja", "ko"];
const SEO_LOCALES = Object.freeze({
  en: "en_US",
  "zh-Hant": "zh_TW",
  ja: "ja_JP",
  ko: "ko_KR"
});
const SEO_KEYWORDS = Object.freeze([
  "USDC",
  "Arc Testnet",
  "account abstraction",
  "AA wallet",
  "payment link",
  "group payment",
  "non-custodial"
]);
const IP_LANGUAGE_ENDPOINT = "https://ipwho.is/";
const provider = getProvider(ARC_RPC_URL);

const translations = {
  en: {
    appTitle: "USDC AA Payment",
    docTitle: "USDC AA Payment | Arc Testnet Payment Links",
    metaDescription: "Create non-custodial USDC group payment links on Arc Testnet for EOA and AA wallet receivers. Payers connect a wallet, approve USDC, and pay their equal share on-chain.",
    createPaymentTitle: "Create Payment",
    receiverDefault: "Receiver defaults to wallet address",
    receiverAddress: "Receiver address",
    payerCount: "Payers",
    totalAmountUsdc: "Total USDC",
    paymentLinkAmount: "Payment amount",
    createPaymentButton: "Create payment",
    connectedAddress: "Connected address",
    paymentLink: "Payment link",
    copyPaymentLink: "Copy link",
    openPaymentLink: "Open link",
    queryPayTitle: "Status / Pay",
    rpcHint: "Status is read from chain by RPC",
    id: "Id",
    queryStatus: "Refresh status",
    pay: "Pay",
    status: "Status",
    totalAmount: "Total amount",
    paidCount: "Paid",
    receivedAmount: "Received",
    notConnected: "Not connected",
    connectWallet: "Connect wallet",
    disconnectWallet: "Disconnect",
    statusCreated: "Collecting",
    statusCompleted: "Completed",
    statusCancelled: "Cancelled",
    statusMissing: "Not found",
    perPersonSuffix: " / person",
    peopleProgress: "{paid}/{max} people",
    viewTx: "View transaction {hash}",
    invalidAddress: "{label} is not a valid address",
    invalidGroupId: "Id is not bytes32: {value}",
    txNoReceipt: "Transaction was sent but not confirmed within 120 seconds. Check ArcScan: {hash}",
    txFailed: "Transaction failed. Check ArcScan: {hash}",
    noWallet: "No browser wallet detected. Install MetaMask or Rabby first",
    disconnected: "Disconnected from this page",
    connected: "Connected {address}",
    amountNotDivisible: "Total amount must divide evenly by payers",
    invalidPayerCount: "Payers must be an integer from 1 to {max}",
    amountGtZero: "Total amount must be greater than 0",
    managerNoCode: "PaymentManager has no contract code. Check deployment address and network",
    createTxSent: "Create transaction sent, waiting for confirmation: {hash}",
    groupCreated: "Payment group created. The payment link can be sent to payers",
    paidStatus: "Paid",
    rowIndexStatus: "Index / Status",
    amount: "Amount",
    payer: "Payer",
    paymentTime: "Payment time",
    noPayers: "No payers yet",
    groupIdRequired: "Id is required",
    statusRefreshed: "Status refreshed",
    groupNotPayable: "This payment group cannot be paid: {status}",
    alreadyPaidGroup: "This wallet has already paid this payment group",
    insufficientBalance: "Insufficient USDC balance. Need {amount}",
    preparingPay: "Preparing to pay {amount}. Confirm in your wallet",
    approveTxSent: "Approval transaction sent, waiting for confirmation: {hash}",
    payTxSent: "Payment transaction sent, waiting for confirmation: {hash}",
    payComplete: "Payment complete",
    noPaymentLink: "Payment link has not been generated",
    copyUnsupported: "This browser cannot copy automatically. Select and copy the payment link manually",
    linkCopied: "Payment link copied",
    linkLoaded: "Payment link loaded. Connect wallet to pay",
    initialMessage: "Connect wallet to autofill receiver address",
    footerDocs: "Documentation",
    footerGithub: "GitHub"
  },
  "zh-Hant": {
    appTitle: "USDC AA收款",
    docTitle: "USDC AA收款 | Arc 測試網付款連結",
    metaDescription: "在 Arc 測試網建立非託管 USDC 群組收款連結，支援 EOA 與 AA 智慧帳戶收款地址，付款人連接錢包後按比例鏈上支付。",
    createPaymentTitle: "建立收款",
    receiverDefault: "收款地址預設使用錢包地址",
    receiverAddress: "收款地址",
    payerCount: "收款人數",
    totalAmountUsdc: "總金額 USDC",
    paymentLinkAmount: "付款連結金額",
    createPaymentButton: "建立收款",
    connectedAddress: "連接地址",
    paymentLink: "付款連結",
    copyPaymentLink: "複製連結",
    openPaymentLink: "開啟連結",
    queryPayTitle: "查詢 / 付款",
    rpcHint: "頁面透過 RPC 讀取鏈上狀態",
    id: "Id",
    queryStatus: "查詢狀態",
    pay: "付款",
    status: "狀態",
    totalAmount: "總金額",
    paidCount: "已付款",
    receivedAmount: "已收金額",
    notConnected: "未連接",
    connectWallet: "連接錢包",
    disconnectWallet: "退出錢包",
    statusCreated: "收款中",
    statusCompleted: "已完成",
    statusCancelled: "已取消",
    statusMissing: "不存在",
    perPersonSuffix: " / 人",
    peopleProgress: "{paid}/{max} 人",
    viewTx: "查看交易 {hash}",
    invalidAddress: "{label} 不是有效地址",
    invalidGroupId: "Id 不是 bytes32：{value}",
    txNoReceipt: "交易已發送但 120 秒內沒有確認，請在 ArcScan 查詢：{hash}",
    txFailed: "交易執行失敗，請在 ArcScan 查詢：{hash}",
    noWallet: "沒有偵測到瀏覽器錢包，請先安裝 MetaMask / Rabby",
    disconnected: "已退出目前頁面連接狀態",
    connected: "已連接 {address}",
    amountNotDivisible: "總金額不能整除人數",
    invalidPayerCount: "收款人數必須是 1 到 {max} 的整數",
    amountGtZero: "總金額必須大於 0",
    managerNoCode: "PaymentManager 地址沒有合約代碼，請確認部署地址和網路",
    createTxSent: "建立交易已發送，等待確認：{hash}",
    groupCreated: "收款組已建立，付款連結可以發送給付款人",
    paidStatus: "已支付",
    rowIndexStatus: "序號 / 狀態",
    amount: "金額",
    payer: "付款人",
    paymentTime: "付款時間",
    noPayers: "暫無付款人",
    groupIdRequired: "Id 不能為空",
    statusRefreshed: "狀態已刷新",
    groupNotPayable: "目前收款組不可支付：{status}",
    alreadyPaidGroup: "目前錢包地址已經支付過該收款組",
    insufficientBalance: "USDC 餘額不足，需要 {amount}",
    preparingPay: "準備支付 {amount}，請在錢包確認",
    approveTxSent: "授權交易已發送，等待確認：{hash}",
    payTxSent: "付款交易已發送，等待確認：{hash}",
    payComplete: "付款完成",
    noPaymentLink: "付款連結還沒有產生",
    copyUnsupported: "目前瀏覽器不支援自動複製，請手動選中付款連結複製",
    linkCopied: "付款連結已複製",
    linkLoaded: "已載入付款連結，連接錢包後可付款",
    initialMessage: "連接錢包後會預設填入收款地址",
    footerDocs: "文件",
    footerGithub: "GitHub"
  },
  ja: {
    appTitle: "USDC AA 受取",
    docTitle: "USDC AA 受取 | Arc テストネット支払いリンク",
    metaDescription: "Arc テストネットで非カストディアルな USDC グループ支払いリンクを作成します。EOA と AA スマートアカウントの受取アドレスに対応し、支払者はウォレット接続後にオンチェーンで均等額を支払います。",
    createPaymentTitle: "受取を作成",
    receiverDefault: "受取アドレスはウォレットアドレスを既定で使用",
    receiverAddress: "受取アドレス",
    payerCount: "支払人数",
    totalAmountUsdc: "合計 USDC",
    paymentLinkAmount: "支払いリンク金額",
    createPaymentButton: "受取を作成",
    connectedAddress: "接続アドレス",
    paymentLink: "支払いリンク",
    copyPaymentLink: "リンクをコピー",
    openPaymentLink: "リンクを開く",
    queryPayTitle: "確認 / 支払い",
    rpcHint: "RPC でオンチェーン状態を読み取ります",
    id: "Id",
    queryStatus: "状態を更新",
    pay: "支払う",
    status: "状態",
    totalAmount: "合計金額",
    paidCount: "支払い済み",
    receivedAmount: "受取済み金額",
    notConnected: "未接続",
    connectWallet: "ウォレット接続",
    disconnectWallet: "切断",
    statusCreated: "受付中",
    statusCompleted: "完了",
    statusCancelled: "キャンセル済み",
    statusMissing: "存在しません",
    perPersonSuffix: " / 人",
    peopleProgress: "{paid}/{max} 人",
    viewTx: "取引を見る {hash}",
    invalidAddress: "{label} は有効なアドレスではありません",
    invalidGroupId: "Id は bytes32 ではありません: {value}",
    txNoReceipt: "取引は送信されましたが 120 秒以内に確認されませんでした。ArcScan で確認してください: {hash}",
    txFailed: "取引が失敗しました。ArcScan で確認してください: {hash}",
    noWallet: "ブラウザウォレットが見つかりません。MetaMask / Rabby をインストールしてください",
    disconnected: "このページの接続状態を解除しました",
    connected: "{address} に接続しました",
    amountNotDivisible: "合計金額は人数で割り切れる必要があります",
    invalidPayerCount: "支払人数は 1 から {max} の整数である必要があります",
    amountGtZero: "合計金額は 0 より大きい必要があります",
    managerNoCode: "PaymentManager にコントラクトコードがありません。デプロイアドレスとネットワークを確認してください",
    createTxSent: "作成取引を送信しました。確認待ち: {hash}",
    groupCreated: "受取グループを作成しました。支払いリンクを送信できます",
    paidStatus: "支払い済み",
    rowIndexStatus: "番号 / 状態",
    amount: "金額",
    payer: "支払者",
    paymentTime: "支払い時間",
    noPayers: "支払者はまだいません",
    groupIdRequired: "Id は必須です",
    statusRefreshed: "状態を更新しました",
    groupNotPayable: "この受取グループは支払いできません: {status}",
    alreadyPaidGroup: "このウォレットはすでにこの受取グループに支払っています",
    insufficientBalance: "USDC 残高が不足しています。必要額 {amount}",
    preparingPay: "{amount} を支払います。ウォレットで確認してください",
    approveTxSent: "承認取引を送信しました。確認待ち: {hash}",
    payTxSent: "支払い取引を送信しました。確認待ち: {hash}",
    payComplete: "支払い完了",
    noPaymentLink: "支払いリンクはまだ生成されていません",
    copyUnsupported: "このブラウザは自動コピーに対応していません。支払いリンクを手動で選択してコピーしてください",
    linkCopied: "支払いリンクをコピーしました",
    linkLoaded: "支払いリンクを読み込みました。ウォレット接続後に支払えます",
    initialMessage: "ウォレット接続後、受取アドレスが自動入力されます",
    footerDocs: "ドキュメント",
    footerGithub: "GitHub"
  },
  ko: {
    appTitle: "USDC AA 수금",
    docTitle: "USDC AA 수금 | Arc 테스트넷 결제 링크",
    metaDescription: "Arc 테스트넷에서 비수탁 USDC 그룹 결제 링크를 만듭니다. EOA와 AA 스마트 계정 수금 주소를 지원하며, 결제자는 지갑을 연결한 뒤 온체인에서 균등 금액을 결제합니다.",
    createPaymentTitle: "수금 만들기",
    receiverDefault: "수금 주소는 기본적으로 지갑 주소를 사용합니다",
    receiverAddress: "수금 주소",
    payerCount: "결제 인원",
    totalAmountUsdc: "총 USDC",
    paymentLinkAmount: "결제 링크 금액",
    createPaymentButton: "수금 만들기",
    connectedAddress: "연결 주소",
    paymentLink: "결제 링크",
    copyPaymentLink: "링크 복사",
    openPaymentLink: "링크 열기",
    queryPayTitle: "조회 / 결제",
    rpcHint: "RPC로 온체인 상태를 읽습니다",
    id: "Id",
    queryStatus: "상태 새로고침",
    pay: "결제",
    status: "상태",
    totalAmount: "총액",
    paidCount: "결제됨",
    receivedAmount: "수령 금액",
    notConnected: "연결 안 됨",
    connectWallet: "지갑 연결",
    disconnectWallet: "연결 해제",
    statusCreated: "수금 중",
    statusCompleted: "완료",
    statusCancelled: "취소됨",
    statusMissing: "없음",
    perPersonSuffix: " / 인",
    peopleProgress: "{paid}/{max}명",
    viewTx: "거래 보기 {hash}",
    invalidAddress: "{label}이(가) 유효한 주소가 아닙니다",
    invalidGroupId: "Id가 bytes32가 아닙니다: {value}",
    txNoReceipt: "거래가 전송되었지만 120초 안에 확인되지 않았습니다. ArcScan에서 확인하세요: {hash}",
    txFailed: "거래가 실패했습니다. ArcScan에서 확인하세요: {hash}",
    noWallet: "브라우저 지갑을 감지하지 못했습니다. MetaMask / Rabby를 먼저 설치하세요",
    disconnected: "현재 페이지 연결 상태를 해제했습니다",
    connected: "{address} 연결됨",
    amountNotDivisible: "총액은 인원수로 나누어 떨어져야 합니다",
    invalidPayerCount: "결제 인원은 1부터 {max}까지의 정수여야 합니다",
    amountGtZero: "총액은 0보다 커야 합니다",
    managerNoCode: "PaymentManager 주소에 컨트랙트 코드가 없습니다. 배포 주소와 네트워크를 확인하세요",
    createTxSent: "생성 거래가 전송되었습니다. 확인 대기 중: {hash}",
    groupCreated: "수금 그룹이 생성되었습니다. 결제 링크를 결제자에게 보낼 수 있습니다",
    paidStatus: "결제됨",
    rowIndexStatus: "번호 / 상태",
    amount: "금액",
    payer: "결제자",
    paymentTime: "결제 시간",
    noPayers: "아직 결제자가 없습니다",
    groupIdRequired: "Id는 비워둘 수 없습니다",
    statusRefreshed: "상태가 새로고침되었습니다",
    groupNotPayable: "현재 수금 그룹은 결제할 수 없습니다: {status}",
    alreadyPaidGroup: "현재 지갑 주소는 이미 이 수금 그룹에 결제했습니다",
    insufficientBalance: "USDC 잔액이 부족합니다. 필요 금액 {amount}",
    preparingPay: "{amount} 결제를 준비합니다. 지갑에서 확인하세요",
    approveTxSent: "승인 거래가 전송되었습니다. 확인 대기 중: {hash}",
    payTxSent: "결제 거래가 전송되었습니다. 확인 대기 중: {hash}",
    payComplete: "결제가 완료되었습니다",
    noPaymentLink: "결제 링크가 아직 생성되지 않았습니다",
    copyUnsupported: "현재 브라우저는 자동 복사를 지원하지 않습니다. 결제 링크를 직접 선택해 복사하세요",
    linkCopied: "결제 링크가 복사되었습니다",
    linkLoaded: "결제 링크를 불러왔습니다. 지갑 연결 후 결제할 수 있습니다",
    initialMessage: "지갑을 연결하면 수금 주소가 자동 입력됩니다",
    footerDocs: "문서",
    footerGithub: "GitHub"
  }
};

const elements = {
  languageSelect: document.querySelector("#languageSelect"),
  receiverAddress: document.querySelector("#receiverAddress"),
  payerCount: document.querySelector("#payerCount"),
  totalAmount: document.querySelector("#totalAmount"),
  calculatedAmount: document.querySelector("#calculatedAmount"),
  paymentLinkBox: document.querySelector("#paymentLinkBox"),
  connectedAddressText: document.querySelector("#connectedAddressText"),
  paymentLink: document.querySelector("#paymentLink"),
  copyPaymentLink: document.querySelector("#copyPaymentLink"),
  openPaymentLink: document.querySelector("#openPaymentLink"),
  queryGroupLabelText: document.querySelector("#queryGroupLabelText"),
  queryGroupId: document.querySelector("#queryGroupId"),
  connectWallet: document.querySelector("#connectWallet"),
  createPayment: document.querySelector("#createPayment"),
  queryPayment: document.querySelector("#queryPayment"),
  payPayment: document.querySelector("#payPayment"),
  networkBadge: document.querySelector("#networkBadge"),
  paymentStatus: document.querySelector("#paymentStatus"),
  paymentAmount: document.querySelector("#paymentAmount"),
  paymentReceiver: document.querySelector("#paymentReceiver"),
  paymentPayer: document.querySelector("#paymentPayer"),
  paymentPaidAt: document.querySelector("#paymentPaidAt"),
  payerRows: document.querySelector("#payerRows"),
  txLinks: document.querySelector("#txLinks"),
  messageLog: document.querySelector("#messageLog")
};

let browserProvider;
let signer;
let connectedAddress;
let loginSignature;
let groupDraft;
let activeGroupId;
let currentLanguage = "en";
let latestGroupDetails;
let messageState;

elements.payerCount.max = String(MAX_PAYERS);

function isSupportedLanguage(language) {
  return SUPPORTED_LANGUAGES.includes(language);
}

function t(key, values = {}) {
  const message = translations[currentLanguage]?.[key] ?? translations.en[key] ?? key;
  return message.replace(/\{(\w+)\}/g, (_, name) => (
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : `{${name}}`
  ));
}

function syncWalletControlsText() {
  elements.connectWallet.textContent = signer ? t("disconnectWallet") : t("connectWallet");
  elements.networkBadge.textContent = signer ? ARC_TESTNET.chainName : t("notConnected");
}

function isActionLocked(element) {
  return element.dataset.actionLocked === "true";
}

function setActionLocked(element, locked) {
  if (locked) {
    element.dataset.actionLocked = "true";
    element.disabled = true;
    return;
  }

  delete element.dataset.actionLocked;
  if (element.getAttribute("aria-busy") !== "true") {
    element.disabled = false;
  }
}

function syncQueryLabel() {
  const showsReceiver = document.body.dataset.mode === "pay" && elements.queryGroupId.readOnly;
  elements.queryGroupLabelText.textContent = showsReceiver ? t("receiverAddress") : t("id");
}

function getPathId() {
  try {
    return decodeURIComponent(window.location.pathname.replace(/^\/+|\/+$/g, ""));
  } catch {
    return "";
  }
}

function isNonCanonicalRoute() {
  return getPathId() !== "";
}

function getSiteRootUrl() {
  return new URL("/", window.location.href).toString();
}

function setMetaContent(selector, content) {
  const element = document.querySelector(selector);
  if (element) {
    element.setAttribute("content", content);
  }
}

function buildStructuredData(rootUrl) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${rootUrl}#webapp`,
    name: t("appTitle"),
    alternateName: ["Arc USDC AA Payment", "USDC AA Payment"],
    url: rootUrl,
    description: t("metaDescription"),
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires a Web3 wallet such as MetaMask or Rabby for on-chain payment actions.",
    inLanguage: SUPPORTED_LANGUAGES,
    isAccessibleForFree: true,
    softwareVersion: "0.1.0",
    creator: {
      "@type": "Organization",
      name: "okuai",
      url: "https://github.com/okuai"
    },
    sameAs: ["https://github.com/okuai/usdcaa"],
    keywords: SEO_KEYWORDS.join(", "),
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD"
    },
    featureList: [
      "Create one USDC payment link for a payment group",
      "Split a total USDC amount evenly across payers",
      "Read payment status from Arc Testnet RPC",
      "Transfer USDC directly from payer to receiver without custody",
      "Support EOA and AA smart account receiver addresses"
    ],
    about: [
      {
        "@type": "Thing",
        name: "Arc Testnet"
      },
      {
        "@type": "Thing",
        name: "USDC"
      },
      {
        "@type": "Thing",
        name: "Account abstraction"
      }
    ]
  };
}

function syncSeoMetadata() {
  const rootUrl = getSiteRootUrl();
  const title = t("docTitle");
  const description = t("metaDescription");
  const robotsContent = isNonCanonicalRoute()
    ? "noindex, nofollow"
    : "index, follow, max-image-preview:large";

  document.title = title;
  setMetaContent("#metaDescription", description);
  setMetaContent("#robotsMeta", robotsContent);
  setMetaContent("#googlebotMeta", robotsContent);
  setMetaContent("#bingbotMeta", robotsContent);
  setMetaContent("#ogTitle", title);
  setMetaContent("#ogDescription", description);
  setMetaContent("#ogUrl", rootUrl);
  setMetaContent("#ogLocale", SEO_LOCALES[currentLanguage] ?? SEO_LOCALES.en);
  setMetaContent("#twitterTitle", title);
  setMetaContent("#twitterDescription", description);

  const canonicalUrl = document.querySelector("#canonicalUrl");
  if (canonicalUrl) {
    canonicalUrl.href = rootUrl;
  }

  const structuredData = document.querySelector("#structuredData");
  if (structuredData) {
    structuredData.textContent = JSON.stringify(buildStructuredData(rootUrl), null, 2);
  }
}

function applyStaticTranslations() {
  document.documentElement.lang = currentLanguage;
  syncSeoMetadata();
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  syncWalletControlsText();
  syncQueryLabel();
}

function setLanguage(language, { persist = false } = {}) {
  currentLanguage = isSupportedLanguage(language) ? language : "en";
  if (elements.languageSelect) {
    elements.languageSelect.value = currentLanguage;
  }
  applyStaticTranslations();
  refreshAmountPreview();

  if (latestGroupDetails) {
    renderGroupDetails(latestGroupDetails);
  }
  renderMessageState();

  if (persist) {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
  }
}

function countryToLanguage(countryCode) {
  const code = String(countryCode || "").toUpperCase();
  if (["TW", "HK", "MO"].includes(code)) return "zh-Hant";
  if (code === "JP") return "ja";
  if (code === "KR") return "ko";
  return "en";
}

async function detectLanguageFromIp() {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(IP_LANGUAGE_ENDPOINT, {
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) return "en";

    const payload = await response.json();
    if (payload.success === false) return "en";
    return countryToLanguage(payload.country_code ?? payload.country);
  } catch {
    return "en";
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function initLanguage() {
  const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (isSupportedLanguage(savedLanguage)) {
    setLanguage(savedLanguage);
    return;
  }

  if (savedLanguage) {
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  }

  setLanguage("en");
  const detectedLanguage = await detectLanguageFromIp();
  const latestSavedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (isSupportedLanguage(latestSavedLanguage)) {
    setLanguage(latestSavedLanguage);
    return;
  }
  setLanguage(detectedLanguage);
}

function renderMessageState() {
  if (!messageState) return;
  elements.messageLog.textContent = messageState.key
    ? t(messageState.key, messageState.values)
    : messageState.text;
  elements.messageLog.dataset.type = messageState.type;
}

function setMessage(message, type = "info") {
  messageState = { text: message, type };
  renderMessageState();
}

function setMessageKey(key, values = {}, type = "info") {
  messageState = { key, values, type };
  renderMessageState();
}

function setConnectedUi(address) {
  connectedAddress = address;
  elements.networkBadge.classList.add("connected");
  syncWalletControlsText();
  elements.connectedAddressText.textContent = address;
  syncPayButtonState();

  if (!elements.receiverAddress.value.trim()) {
    elements.receiverAddress.value = address;
  }
}

function readableError(error) {
  const candidates = [
    error?.shortMessage,
    error?.reason,
    error?.info?.error?.message,
    error?.error?.message,
    error?.cause?.shortMessage,
    error?.cause?.message,
    error?.message
  ].filter(Boolean);

  const message = candidates.find((candidate) => !candidate.includes("could not coalesce error"));
  return message ?? candidates[0] ?? String(error);
}

function assertAddress(value, label) {
  if (!ethers.isAddress(value)) {
    throw new Error(t("invalidAddress", { label }));
  }
}

function assertGroupId(value) {
  if (!ethers.isHexString(value, 32)) {
    throw new Error(t("invalidGroupId", { value }));
  }
}

function getManagerAddress() {
  return DEFAULT_PAYMENT_MANAGER;
}

function statusText(status) {
  if (status === GroupStatus.Created) return t("statusCreated");
  if (status === GroupStatus.Completed) return t("statusCompleted");
  if (status === GroupStatus.Cancelled) return t("statusCancelled");
  return t("statusMissing");
}

function hasConnectedWalletPaid(details) {
  if (!connectedAddress) return false;
  const payerAddress = connectedAddress.toLowerCase();
  return details.payers.some((payer, index) => (
    payer.toLowerCase() === payerAddress && Boolean(details.payments[index]?.paid)
  ));
}

function syncPayButtonState(details = latestGroupDetails) {
  if (!details) {
    setActionLocked(elements.payPayment, false);
    return;
  }

  const shouldLockPayButton = details.group.status !== GroupStatus.Created
    || hasConnectedWalletPaid(details);
  setActionLocked(elements.payPayment, shouldLockPayButton);
}

function formatAddress(address) {
  if (!address || address === ethers.ZeroAddress) return "-";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTime(timestamp) {
  if (!timestamp || timestamp === 0n) return "-";
  return new Date(Number(timestamp) * 1000).toLocaleString();
}

function formatUsdc(value) {
  return `${ethers.formatUnits(value, 6)} USDC`;
}

function setExplorerTx(hash) {
  elements.txLinks.innerHTML = hash
    ? `<a href="${ARC_TESTNET.blockExplorerUrls[0]}/tx/${hash}" target="_blank" rel="noreferrer">${t("viewTx", { hash: `${hash.slice(0, 10)}...` })}</a>`
    : "";
}

function setGroupId(groupId) {
  activeGroupId = groupId;
  elements.queryGroupId.value = groupId;
}

function buildPaymentUrl(groupId) {
  const url = new URL(window.location.href);
  url.pathname = `/${groupId}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function setPaymentLink(groupId) {
  const url = buildPaymentUrl(groupId);
  elements.paymentLink.value = url;
  elements.openPaymentLink.href = url;
  elements.paymentLinkBox.hidden = false;
  return url;
}

async function waitForTransaction(hash, walletSigner) {
  const receipt = await walletSigner.provider.waitForTransaction(hash, 1, 120000);
  if (!receipt) {
    throw new Error(t("txNoReceipt", { hash }));
  }
  if (receipt.status === 0) {
    throw new Error(t("txFailed", { hash }));
  }
  return receipt;
}

async function ensureWallet() {
  if (!window.ethereum) {
    throw new Error(t("noWallet"));
  }

  browserProvider = new ethers.BrowserProvider(window.ethereum);
  await window.ethereum.request({ method: "eth_requestAccounts" });

  const hexChainId = ethers.toBeHex(ARC_TESTNET.chainId);

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexChainId }]
    });
  } catch (error) {
    if (error.code !== 4902) throw error;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: hexChainId,
        chainName: ARC_TESTNET.chainName,
        rpcUrls: ARC_TESTNET.rpcUrls,
        nativeCurrency: ARC_TESTNET.nativeCurrency,
        blockExplorerUrls: ARC_TESTNET.blockExplorerUrls
      }]
    });
  }

  browserProvider = new ethers.BrowserProvider(window.ethereum);
  signer = await browserProvider.getSigner();
  setConnectedUi(await signer.getAddress());

  return signer;
}

async function loginWallet() {
  const activeSigner = await ensureWallet();
  const address = await activeSigner.getAddress();
  const nonce = ethers.hexlify(ethers.randomBytes(16));
  const message = [
    "Arc USDC payment login",
    `Address: ${address}`,
    `Origin: ${window.location.origin}`,
    `Nonce: ${nonce}`
  ].join("\n");

  loginSignature = await activeSigner.signMessage(message);
  localStorage.setItem(LOGIN_STORAGE_KEY, JSON.stringify({
    address,
    signature: loginSignature
  }));
  localStorage.removeItem(LOGOUT_STORAGE_KEY);
  setConnectedUi(address);
  return activeSigner;
}

function disconnectWallet() {
  browserProvider = undefined;
  signer = undefined;
  connectedAddress = undefined;
  loginSignature = undefined;
  localStorage.removeItem(LOGIN_STORAGE_KEY);
  localStorage.setItem(LOGOUT_STORAGE_KEY, "1");
  elements.networkBadge.classList.remove("connected");
  syncWalletControlsText();
  elements.connectedAddressText.textContent = "-";
  syncPayButtonState();
  setMessageKey("disconnected", {}, "success");
}

async function restoreWalletLogin() {
  if (!window.ethereum || localStorage.getItem(LOGOUT_STORAGE_KEY) === "1") {
    return;
  }

  const savedRaw = localStorage.getItem(LOGIN_STORAGE_KEY);
  if (!savedRaw) return;

  let saved;
  try {
    saved = JSON.parse(savedRaw);
  } catch {
    localStorage.removeItem(LOGIN_STORAGE_KEY);
    return;
  }

  const accounts = await window.ethereum.request({ method: "eth_accounts" });
  const savedAddress = saved.address;
  const matchedAddress = accounts.find((account) => (
    account.toLowerCase() === savedAddress?.toLowerCase()
  ));

  if (!matchedAddress) {
    localStorage.removeItem(LOGIN_STORAGE_KEY);
    return;
  }

  browserProvider = new ethers.BrowserProvider(window.ethereum);
  signer = await browserProvider.getSigner(matchedAddress);
  loginSignature = saved.signature;
  setConnectedUi(matchedAddress);
}

async function handleConnectWallet() {
  if (signer) {
    disconnectWallet();
    return;
  }

  await loginWallet();
  setMessageKey("connected", { address: connectedAddress }, "success");
}

function refreshAmountPreview() {
  try {
    const payerCount = Number(elements.payerCount.value);
    const totalAmount = toUsdcUnits(elements.totalAmount.value || "0");
    if (!Number.isInteger(payerCount) || payerCount < 1 || payerCount > MAX_PAYERS || totalAmount <= 0n) {
      elements.calculatedAmount.value = "-";
      return;
    }
    if (totalAmount % BigInt(payerCount) !== 0n) {
      elements.calculatedAmount.value = t("amountNotDivisible");
      return;
    }

    elements.calculatedAmount.value = `${formatUsdc(totalAmount / BigInt(payerCount))}${t("perPersonSuffix")}`;
  } catch {
    elements.calculatedAmount.value = "-";
  }
}

function readGroupForm() {
  const managerAddress = getManagerAddress();
  const receiver = elements.receiverAddress.value.trim();
  assertAddress(receiver, t("receiverAddress"));

  const maxPayers = Number(elements.payerCount.value);
  if (!Number.isInteger(maxPayers) || maxPayers < 1 || maxPayers > MAX_PAYERS) {
    throw new Error(t("invalidPayerCount", { max: MAX_PAYERS }));
  }

  const totalAmount = toUsdcUnits(elements.totalAmount.value);
  if (totalAmount <= 0n) {
    throw new Error(t("amountGtZero"));
  }
  if (totalAmount % BigInt(maxPayers) !== 0n) {
    throw new Error(t("amountNotDivisible"));
  }

  const perPaymentAmount = totalAmount / BigInt(maxPayers);
  elements.calculatedAmount.value = `${formatUsdc(perPaymentAmount)}${t("perPersonSuffix")}`;

  return {
    managerAddress,
    receiver: ethers.getAddress(receiver),
    maxPayers,
    totalAmount,
    perPaymentAmount
  };
}

async function prepareGroupDraft(activeSigner, forceNew = false) {
  const creator = await activeSigner.getAddress();
  const form = readGroupForm();

  const draftMatches = groupDraft
    && groupDraft.creator === creator
    && groupDraft.managerAddress === form.managerAddress
    && groupDraft.receiver === form.receiver
    && groupDraft.maxPayers === form.maxPayers
    && groupDraft.totalAmount === form.totalAmount;

  if (!forceNew && draftMatches) {
    return groupDraft;
  }

  const generated = generateGroupSalt(form.receiver, form.totalAmount, form.maxPayers);
  const groupId = await computeGroupId(provider, form.managerAddress, creator, generated.salt);

  groupDraft = {
    ...form,
    creator,
    salt: generated.salt,
    saltSource: generated.source,
    groupId
  };

  setGroupId(groupId);

  return groupDraft;
}

async function handleCreatePayment() {
  const activeSigner = signer ?? await loginWallet();
  const managerAddress = getManagerAddress();
  const code = await provider.getCode(managerAddress);
  if (code === "0x") {
    throw new Error(t("managerNoCode"));
  }

  const draft = await prepareGroupDraft(activeSigner, true);
  const manager = getPaymentManager(activeSigner, managerAddress);
  const tx = await manager.createGroup(
    draft.salt,
    draft.receiver,
    draft.totalAmount,
    draft.maxPayers
  );

  setExplorerTx(tx.hash);
  setMessageKey("createTxSent", { hash: tx.hash }, "info");
  const receipt = await waitForTransaction(tx.hash, activeSigner);
  setGroupId(draft.groupId);
  setPaymentLink(draft.groupId);
  elements.connectedAddressText.textContent = connectedAddress ?? await activeSigner.getAddress();
  setExplorerTx(receipt.hash);
  await queryGroup(draft.groupId);
  setMessageKey("groupCreated", {}, "success");
}

function renderPayerRows(payers, payments) {
  const rows = payers.map((payer, index) => {
    const payment = payments[index];
    return `
      <div class="payment-row">
        <div>
          <span class="row-index">#${index + 1}</span>
          <span class="row-status">${t("paidStatus")}</span>
        </div>
        <div>${formatUsdc(payment.amount)}</div>
        <div title="${payer}">${formatAddress(payer)}</div>
        <div>${formatTime(payment.paidAt)}</div>
      </div>
    `;
  });

  elements.payerRows.innerHTML = `
    <div class="payment-row payment-row-header">
      <div>${t("rowIndexStatus")}</div>
      <div>${t("amount")}</div>
      <div>${t("payer")}</div>
      <div>${t("paymentTime")}</div>
    </div>
    ${rows.join("") || `<div class="payment-row"><div>${t("noPayers")}</div><div>-</div><div>-</div><div>-</div></div>`}
  `;
}

function renderGroupDetails(details) {
  const { group, payers, payments, groupId } = details;

  elements.paymentStatus.textContent = `${statusText(group.status)} (${group.paidCount}/${group.maxPayers})`;
  elements.paymentAmount.textContent = formatUsdc(group.totalAmount);
  elements.paymentReceiver.textContent = formatAddress(group.receiver);
  elements.paymentReceiver.title = group.receiver;
  elements.paymentPayer.textContent = t("peopleProgress", {
    paid: group.paidCount,
    max: group.maxPayers
  });
  elements.paymentPaidAt.textContent = formatUsdc(group.paidAmount);
  elements.calculatedAmount.value = group.perPaymentAmount > 0n
    ? `${formatUsdc(group.perPaymentAmount)}${t("perPersonSuffix")}`
    : "-";

  setGroupId(groupId);

  if (document.body.dataset.mode === "pay") {
    elements.queryGroupId.value = group.receiver;
    elements.queryGroupId.title = groupId;
    elements.queryGroupId.readOnly = true;
  }

  syncQueryLabel();
  renderPayerRows(payers, payments);
  syncPayButtonState(details);
}

async function queryGroup(groupId = elements.queryGroupId.value.trim()) {
  if (!groupId) throw new Error(t("groupIdRequired"));
  assertGroupId(groupId);

  const { group, payers, payments } = await readGroupDetails(provider, getManagerAddress(), groupId);
  latestGroupDetails = { group, payers, payments, groupId };
  renderGroupDetails(latestGroupDetails);

  return { group, payers, payments };
}

async function handleQueryPayment() {
  const groupId = activeGroupId ?? elements.queryGroupId.value.trim();
  await queryGroup(groupId);
  setPaymentLink(groupId);
  setMessageKey("statusRefreshed", {}, "success");
}

async function handlePayPayment() {
  const activeSigner = signer ?? await loginWallet();
  const groupId = activeGroupId ?? elements.queryGroupId.value.trim();
  if (!groupId) throw new Error(t("groupIdRequired"));
  assertGroupId(groupId);

  const managerAddress = getManagerAddress();
  const { group } = await queryGroup(groupId);
  if (group.status !== GroupStatus.Created) {
    throw new Error(t("groupNotPayable", { status: statusText(group.status) }));
  }

  const payer = await activeSigner.getAddress();
  const manager = getPaymentManager(activeSigner, managerAddress);
  const groupPayment = await manager.getGroupPayment(groupId, payer);
  if (groupPayment.paid) {
    throw new Error(t("alreadyPaidGroup"));
  }

  const usdc = new ethers.Contract(ARC_USDC_ADDRESS, Erc20Abi, activeSigner);
  const balance = await usdc.balanceOf(payer);
  if (balance < group.perPaymentAmount) {
    throw new Error(t("insufficientBalance", { amount: formatUsdc(group.perPaymentAmount) }));
  }

  setMessageKey("preparingPay", { amount: formatUsdc(group.perPaymentAmount) }, "info");
  const receipt = await payGroupWithApproval({
    signer: activeSigner,
    paymentManagerAddress: managerAddress,
    groupId,
    usdcAddress: ARC_USDC_ADDRESS,
    onApproveTx: (hash) => {
      setExplorerTx(hash);
      setMessageKey("approveTxSent", { hash }, "info");
    },
    onPayTx: (hash) => {
      setExplorerTx(hash);
      setMessageKey("payTxSent", { hash }, "info");
    }
  });

  setExplorerTx(receipt.hash);
  await queryGroup(groupId);
  setMessageKey("payComplete", {}, "success");
}

async function handleCopyPaymentLink() {
  const link = elements.paymentLink.value;
  if (!link) throw new Error(t("noPaymentLink"));

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(link);
  } else {
    elements.paymentLink.focus();
    elements.paymentLink.select();
    const copied = document.execCommand("copy");
    if (!copied) {
      throw new Error(t("copyUnsupported"));
    }
  }

  setMessageKey("linkCopied", {}, "success");
}

async function hydrateFromUrl() {
  const pathId = getPathId();
  const groupId = ethers.isHexString(pathId, 32) ? pathId : undefined;

  if (!groupId) return;

  assertGroupId(groupId);
  setGroupId(groupId);
  setPaymentLink(groupId);
  if (window.location.href !== elements.paymentLink.value) {
    window.history.replaceState({}, "", elements.paymentLink.value);
  }
  document.body.dataset.mode = "pay";
  syncSeoMetadata();

  await queryGroup(groupId);
  setMessageKey("linkLoaded", {}, "success");
}

function bindAction(element, handler) {
  element.addEventListener("click", async () => {
    const previousMinWidth = element.style.minWidth;
    element.style.minWidth = `${element.offsetWidth}px`;
    element.disabled = true;
    element.setAttribute("aria-busy", "true");
    try {
      await handler();
    } catch (error) {
      console.error(error);
      setMessage(readableError(error), "error");
    } finally {
      element.removeAttribute("aria-busy");
      element.disabled = isActionLocked(element);
      element.style.minWidth = previousMinWidth;
    }
  });
}

bindAction(elements.connectWallet, handleConnectWallet);
bindAction(elements.createPayment, handleCreatePayment);
bindAction(elements.queryPayment, handleQueryPayment);
bindAction(elements.payPayment, handlePayPayment);
bindAction(elements.copyPaymentLink, handleCopyPaymentLink);

document.body.dataset.mode = "create";
elements.languageSelect.addEventListener("change", (event) => {
  setLanguage(event.target.value, { persist: true });
});
elements.payerCount.addEventListener("input", refreshAmountPreview);
elements.totalAmount.addEventListener("input", refreshAmountPreview);

setLanguage("en");
setMessageKey("initialMessage", {}, "info");

initLanguage().catch((error) => {
  console.error(error);
  setLanguage("en");
});

restoreWalletLogin().catch((error) => {
  console.error(error);
  localStorage.removeItem(LOGIN_STORAGE_KEY);
});

hydrateFromUrl().catch((error) => {
  console.error(error);
  setMessage(readableError(error), "error");
});
