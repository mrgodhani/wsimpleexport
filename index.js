import 'dotenv/config'
import puppeteer from 'puppeteer-extra';
import fs from 'fs';
import { stringify } from 'csv-stringify'
import { input, password, checkbox } from '@inquirer/prompts';
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import dayjs from 'dayjs'
import ora from 'ora'

puppeteer.use(StealthPlugin())
const exchangeRateKey = process.env.FOREX_API_KEY
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

await page.goto('https://my.wealthsimple.com/app/login');

const email = await input({ message: 'What is your email?' });
const passwordVal  = await password({ message: 'What is your password? '});

await page.type('input[inputmode="email"]', email, { delay: 50 });
await page.type('input[type="password"]', passwordVal, { delay: 50 });
await page.locator('button[type="submit"]').click();

// Handle Multi Factor
const mfaAuthenticate = async () => {
    const mfa = await input({ message: 'Please enter MFA code', validate: (input) => { return input.length === 6} })
    await page.type('input[type="text"]', mfa);
    await page.locator('button[type="submit"]').click();
    const hasErrorAlert = await page.$eval('.notification-message', el => el.innerText)
    if (hasErrorAlert === 'The provided two-step verification code is invalid.') {
        await mfaAuthenticate()
    }
}

await mfaAuthenticate()
await page.waitForNavigation();
await page.waitForSelector('main');


  // Get cookies from the current page
  const cookies = await page.cookies();
  const oauthData = cookies.filter((item) => item.name === '_oauth2_access_v2')[0]
  const decodedOauthData = JSON.parse(decodeURIComponent(oauthData.value))
  const accessToken = decodedOauthData.access_token
  const accessTokenExpiresAt = decodedOauthData.expires_at
  const accessTokenExpiresIn = decodedOauthData.expires_in
  const identityCanonicalId = decodedOauthData.identity_canonical_id
  const tokenType = 'Bearer'

  const result = await page.evaluate(async (tokenType, accessToken, identityCanonicalId) => {
    const myHeaders = new Headers();
    myHeaders.append("x-ws-profile", "trade");
    myHeaders.append("x-ws-api-version", "12");
    myHeaders.append("x-platform-os", "web");
    myHeaders.append("content-type", "application/json");
    myHeaders.append("accept", "*/*");
    myHeaders.append("DNT", "1");
    myHeaders.append("authorization", `${tokenType} ${accessToken}`);
    const raw = JSON.stringify({
        "operationName": "FetchAllAccountFinancials",
        "variables": {
          "pageSize": 25,
          "withNewAccountFinancials": true,
          "identityId": identityCanonicalId
        },
        "query": "query FetchAllAccountFinancials($identityId: ID!, $startDate: Date, $pageSize: Int = 25, $cursor: String, $withNewAccountFinancials: Boolean!) {\n  identity(id: $identityId) {\n    id\n    ...AllAccountFinancials\n    __typename\n  }\n}\n\nfragment AllAccountFinancials on Identity {\n  accounts(filter: {}, first: $pageSize, after: $cursor) {\n    pageInfo {\n      hasNextPage\n      endCursor\n      __typename\n    }\n    edges {\n      cursor\n      node {\n        ...AccountWithFinancials\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment AccountWithFinancials on Account {\n  ...AccountWithLink\n  ...AccountFinancials\n  __typename\n}\n\nfragment AccountWithLink on Account {\n  ...Account\n  linkedAccount {\n    ...Account\n    __typename\n  }\n  __typename\n}\n\nfragment Account on Account {\n  ...AccountCore\n  custodianAccounts {\n    ...CustodianAccount\n    __typename\n  }\n  __typename\n}\n\nfragment AccountCore on Account {\n  id\n  archivedAt\n  branch\n  closedAt\n  createdAt\n  cacheExpiredAt\n  currency\n  requiredIdentityVerification\n  unifiedAccountType\n  supportedCurrencies\n  nickname\n  status\n  accountOwnerConfiguration\n  accountFeatures {\n    ...AccountFeature\n    __typename\n  }\n  accountOwners {\n    ...AccountOwner\n    __typename\n  }\n  type\n  __typename\n}\n\nfragment AccountFeature on AccountFeature {\n  name\n  enabled\n  __typename\n}\n\nfragment AccountOwner on AccountOwner {\n  accountId\n  identityId\n  accountNickname\n  clientCanonicalId\n  accountOpeningAgreementsSigned\n  name\n  email\n  ownershipType\n  activeInvitation {\n    ...AccountOwnerInvitation\n    __typename\n  }\n  sentInvitations {\n    ...AccountOwnerInvitation\n    __typename\n  }\n  __typename\n}\n\nfragment AccountOwnerInvitation on AccountOwnerInvitation {\n  id\n  createdAt\n  inviteeName\n  inviteeEmail\n  inviterName\n  inviterEmail\n  updatedAt\n  sentAt\n  status\n  __typename\n}\n\nfragment CustodianAccount on CustodianAccount {\n  id\n  branch\n  custodian\n  status\n  updatedAt\n  __typename\n}\n\nfragment AccountFinancials on Account {\n  id\n  custodianAccounts {\n    id\n    financials {\n      current {\n        ...CustodianAccountCurrentFinancialValues\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  financials {\n    currentCombined @include(if: $withNewAccountFinancials) {\n      ...AccountCurrentFinancials\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment CustodianAccountCurrentFinancialValues on CustodianAccountCurrentFinancialValues {\n  deposits {\n    ...Money\n    __typename\n  }\n  earnings {\n    ...Money\n    __typename\n  }\n  netDeposits {\n    ...Money\n    __typename\n  }\n  netLiquidationValue {\n    ...Money\n    __typename\n  }\n  withdrawals {\n    ...Money\n    __typename\n  }\n  __typename\n}\n\nfragment Money on Money {\n  amount\n  cents\n  currency\n  __typename\n}\n\nfragment AccountCurrentFinancials on AccountCurrentFinancials {\n  netLiquidationValue {\n    ...Money\n    __typename\n  }\n  netDeposits {\n    ...Money\n    __typename\n  }\n  simpleReturns(referenceDate: $startDate) {\n    ...SimpleReturns\n    __typename\n  }\n  totalDeposits {\n    ...Money\n    __typename\n  }\n  totalWithdrawals {\n    ...Money\n    __typename\n  }\n  __typename\n}\n\nfragment SimpleReturns on SimpleReturns {\n  amount {\n    ...Money\n    __typename\n  }\n  asOf\n  rate\n  referenceDate\n  __typename\n}"
      });
    const response = await fetch('/graphql', {
        method: 'POST',
        credentials: 'include',
        headers: myHeaders,
        body: raw,
      })
    const data = await response.json()
    return data
}, tokenType, accessToken, identityCanonicalId)

const accountDetails = result.data.identity.accounts.edges
.filter((item) => 
    item.node.status !== 'closed' && ['tfsa', 'rrsp'].includes(item.node.type) && item.node.unifiedAccountType !== "MANAGED_TFSA" && item.node.archivedAt === null)

const selectedAccount = await checkbox({
    message: 'Please select the account',
    choices: accountDetails.map((item) => {
        const name = item.node.type === 'tfsa' ? 'TFSA' : 'RRSP'
        const finalName = `${name} (${item.node.currency})`
        return {
            value: { id: item.node.id, currency: item.node.currency },
            name: finalName
        }
    }),

})

const accountResults = await page.evaluate(async (tokenType, accessToken, identityCanonicalId, selectedAccount) => {
    const idsSelected = selectedAccount.map(item => item.id)
    const myHeaders = new Headers();
    myHeaders.append("x-ws-profile", "trade");
    myHeaders.append("x-ws-api-version", "12");
    myHeaders.append("x-platform-os", "web");
    myHeaders.append("content-type", "application/json");
    myHeaders.append("accept", "*/*");
    myHeaders.append("DNT", "1");
    myHeaders.append("authorization", `${tokenType} ${accessToken}`);
    const raw = JSON.stringify({
        "operationName": "FetchIdentityPaginatedDocuments",
        "variables": {
            "id": identityCanonicalId,
            "accountIds": idsSelected,
            "locale": "en-CA"
        },
        "query": "query FetchIdentityPaginatedDocuments($id: ID!, $limit: Int, $offset: Int, $locale: String, $categories: [String!], $accountIds: [String!], $startDate: String, $endDate: String) {\n  identity(id: $id) {\n    id\n    ...IdentityPaginatedDocuments\n    __typename\n  }\n}\n\nfragment IdentityPaginatedDocuments on Identity {\n  documents(\n    limit: $limit\n    offset: $offset\n    locale: $locale\n    categories: $categories\n    account_ids: $accountIds\n    start_date: $startDate\n    end_date: $endDate\n  ) {\n    ...Documents\n    __typename\n  }\n  __typename\n}\n\nfragment Documents on PaginatedDocuments {\n  totalCount: total_count\n  offset\n  results {\n    ...Document\n    __typename\n  }\n  __typename\n}\n\nfragment Document on Document {\n  id\n  createdAt: created_at\n  availableAt: available_at\n  displayAt: display_at\n  filename\n  period\n  frequency\n  type\n  downloadUrl: download_url\n  uploaderName: uploader_name\n  s3BucketName: s3_bucket_name\n  s3Key: s3_key\n  category\n  account {\n    id\n    type\n    __typename\n  }\n  documents {\n    ...StatementDocument\n    __typename\n  }\n  __typename\n}\n\nfragment StatementDocument on StatementDocument {\n  id\n  createdAt: created_at\n  downloadUrl: download_url\n  s3BucketName: s3_bucket_name\n  s3Key: s3_key\n  type\n  account {\n    id\n    type\n    custodianAccountIds: custodian_account_ids\n    __typename\n  }\n  __typename\n}"
    })
    const response = await fetch('/graphql', {
        method: 'POST',
        credentials: 'include',
        headers: myHeaders,
        body: raw,
      })
    const data = await response.json()
    return data
}, tokenType, accessToken, identityCanonicalId, selectedAccount)

const spinnerData = ora('Collecting transaction data').start()
const periods = Array.from(new Set(accountResults.data.identity.documents.results.map((item) => item.period)))
const csvTransactions = await page.evaluate(async (tokenType, accessToken, selectedAccount, periods) => {
    const transactions = []
    const myHeaders = new Headers();
    myHeaders.append("x-ws-profile", "trade");
    myHeaders.append("x-ws-api-version", "12");
    myHeaders.append("x-platform-os", "web");
    myHeaders.append("content-type", "application/json");
    myHeaders.append("accept", "*/*");
    myHeaders.append("DNT", "1");
    myHeaders.append("authorization", `${tokenType} ${accessToken}`);
    for (const item of periods) {
        const periodTransactions = await Promise.all(selectedAccount.map(async (account) => {
            const raw = JSON.stringify({
                "operationName": "FetchBrokerageMonthlyStatementTransactions",
                "variables": {
                    "period": item,
                    "accountId": account.id
                },
                "query": "query FetchBrokerageMonthlyStatementTransactions($period: String!, $accountId: String!) {\n  brokerageMonthlyStatements(period: $period, accountId: $accountId) {\n    id\n    statementType\n    createdAt\n    data {\n      ... on BrokerageMonthlyStatementObject {\n        ...BrokerageMonthlyStatementObject\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n\nfragment BrokerageMonthlyStatementObject on BrokerageMonthlyStatementObject {\n  custodianAccountId\n  currentTransactions {\n    ...BrokerageMonthlyStatementTransactions\n    __typename\n  }\n  __typename\n}\n\nfragment BrokerageMonthlyStatementTransactions on BrokerageMonthlyStatementTransactions {\n  balance\n  cashMovement\n  description\n  transactionDate\n  transactionType\n  __typename\n}"
            });
            const response = await fetch('/graphql', {
                method: 'POST',
                credentials: 'include',
                headers: myHeaders,
                body: raw,
            });
            const data = await response.json();
            const transactionData = data.data.brokerageMonthlyStatements;

            if (transactionData.length > 0) {
                return transactionData.flatMap(transaction => 
                    transaction.data.currentTransactions.map(item => {
                        item.currency = account.currency;
                        return item;
                    })
                );
            } else {
                return [];
            }
        }));
        transactions.push(...periodTransactions.flat());
    }
    return transactions
}, tokenType, accessToken, selectedAccount, periods)
spinnerData.stop()

const spinner = ora('Processing transactions to CSV').start()
const transactionDataForCSV = []
const columns = {
    balance: 'Balance',
    cashMovement: 'Cash Movement',
    description: 'Description',
    transactionDate: 'Transaction Date',
    transactionType: 'Transaction Type',
    currency: 'Currency'
}

for (let i = 0; i < csvTransactions.length; i++) {
    let balance, cashMovement
    if (csvTransactions[i].currency !== 'CAD') {
        const exchangeRate = await fetch(`https://v6.exchangerate-api.com/v6/${exchangeRateKey}/pair/${csvTransactions[i].currency}/CAD/`)
        const result = await exchangeRate.json()
        balance = csvTransactions[i].balance * result.conversion_rate
        cashMovement = csvTransactions[i].cashMovement * result.conversion_rate
    } else {
        balance = csvTransactions[i].balance
        cashMovement = csvTransactions[i].cashMovement
    }
    transactionDataForCSV.push([
        parseFloat(balance).toFixed(2),
        parseFloat(cashMovement).toFixed(2),
        csvTransactions[i].description,
        csvTransactions[i].transactionDate,
        csvTransactions[i].transactionType,
        csvTransactions[i].currency
    ])
}

stringify(
    transactionDataForCSV,
    {
      header: true,
      columns: columns
    },
    (err, output) => {
      if (err) {
        console.error(err)
      }
      fs.writeFileSync(`./wealthsimple-${dayjs().toString()}.csv`, output, (err) => {
        if (err) {
          console.error(err)
        } else {
          console.log('Transactions csv saved')
        }
      })
    }
  )
  spinner.stop()
  console.log('Successfully exported all transactions to CSV')
await browser.close()
