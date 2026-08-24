---
name: transaction-extractor
description: Extract transaction data from web pages and format as JSON using playwriter. Use when the user requests to analyze transactions from an open browser tab, extract financial data from banking websites, parse payment history, or convert transaction tables into structured JSON format.
---

# Transaction Extractor

## Overview

Extract transaction data from web pages using the playwriter MCP tool and convert to structured JSON format. This skill handles banking sites, payment platforms, e-commerce order history, and any web page containing tabular transaction data.

## Workflow

### Step 1: Identify Transaction Elements

Use playwriter to examine the current page structure and locate transaction data:

```javascript
// Get accessibility snapshot to understand page structure
console.log(await accessibilitySnapshot({ page }));
```

Look for transaction patterns such as:
- Tables with columns like date, description, amount, status
- List items containing transaction details
- Grids with payment information
- Repeated card components for transactions

### Step 2: Extract Transaction Data

Use playwriter to extract the transaction information. Choose the appropriate method:

**Method A: Table Extraction**
For structured HTML tables:

```javascript
const transactions = await page.evaluate(() => {
  const rows = Array.from(document.querySelectorAll('table tbody tr'));
  return rows.map(row => {
    const cells = row.querySelectorAll('td');
    return {
      date: cells[0]?.textContent.trim(),
      description: cells[1]?.textContent.trim(),
      amount: cells[2]?.textContent.trim(),
      status: cells[3]?.textContent.trim()
    };
  });
});
console.log(JSON.stringify(transactions, null, 2));
```

**Method B: List/Card Extraction**
For div-based layouts or card components:

```javascript
const transactions = await page.evaluate(() => {
  const items = Array.from(document.querySelectorAll('.transaction-item')); // Adjust selector
  return items.map(item => ({
    date: item.querySelector('.date')?.textContent.trim(),
    description: item.querySelector('.description')?.textContent.trim(),
    amount: item.querySelector('.amount')?.textContent.trim(),
    status: item.querySelector('.status')?.textContent.trim()
  }));
});
console.log(JSON.stringify(transactions, null, 2));
```

**Method C: Custom Selectors**
Adapt selectors based on the accessibility snapshot:

```javascript
// First, identify the pattern
const snapshot = await accessibilitySnapshot({ page, search: /transaction|payment|amount/i });
console.log(snapshot);

// Then extract based on discovered structure
const transactions = await page.evaluate(() => {
  // Custom extraction logic based on page structure
});
```

### Step 3: Clean and Format Data

Process extracted data to ensure consistency:

```javascript
const cleanTransactions = transactions.map(t => ({
  date: t.date || 'N/A',
  description: (t.description || '').replace(/\s+/g, ' ').trim(),
  amount: parseFloat(t.amount?.replace(/[^0-9.-]/g, '') || '0'),
  status: t.status || 'Unknown',
  // Add additional fields as needed
  category: t.category,
  merchant: t.merchant,
  paymentMethod: t.paymentMethod
}));
console.log(JSON.stringify(cleanTransactions, null, 2));
```

### Step 4: Save to File

Create a JSON file with the extracted transactions:

```javascript
// Store in state for later use
state.transactions = cleanTransactions;
```

Then use the create_file tool to save:

```bash
create_file({
  path: "/home/claude/transactions.json",
  file_text: JSON.stringify(cleanTransactions, null, 2)
});
```

## Advanced Patterns

### Pagination Handling

For sites with multiple pages of transactions:

```javascript
state.allTransactions = [];

async function extractPage() {
  const pageTransactions = await page.evaluate(() => {
    // extraction logic
  });
  state.allTransactions.push(...pageTransactions);
}

// Extract first page
await extractPage();

// Navigate through pagination
const hasNext = await page.locator('button:has-text("Next")').isVisible();
if (hasNext) {
  await page.click('button:has-text("Next")');
  await page.waitForLoadState('networkidle');
  await extractPage();
}

console.log(JSON.stringify(state.allTransactions, null, 2));
```

### Date Range Filtering

Filter transactions by date:

```javascript
const startDate = new Date('2024-01-01');
const endDate = new Date('2024-12-31');

const filtered = transactions.filter(t => {
  const txDate = new Date(t.date);
  return txDate >= startDate && txDate <= endDate;
});
```

### Amount Parsing

Handle various currency formats:

```javascript
function parseAmount(amountStr) {
  // Remove currency symbols and commas
  const cleaned = amountStr.replace(/[$€£,]/g, '');
  // Handle parentheses for negative amounts
  if (cleaned.includes('(') && cleaned.includes(')')) {
    return -parseFloat(cleaned.replace(/[()]/g, ''));
  }
  return parseFloat(cleaned);
}
```

## Common Transaction Schemas

### Banking Transactions
```json
{
  "date": "2024-01-15",
  "description": "Amazon Purchase",
  "amount": -45.99,
  "balance": 1234.56,
  "type": "debit",
  "status": "posted"
}
```

### E-commerce Orders
```json
{
  "orderDate": "2024-01-15",
  "orderId": "123-4567890-1234567",
  "items": "Product Name",
  "total": 45.99,
  "status": "Delivered",
  "trackingNumber": "1Z999AA10123456784"
}
```

### Payment Platform
```json
{
  "date": "2024-01-15T10:30:00Z",
  "recipient": "John Doe",
  "amount": 50.00,
  "currency": "USD",
  "status": "Completed",
  "transactionId": "abc123xyz"
}
```

## Troubleshooting

**Empty results**: Use `accessibilitySnapshot()` to verify page structure and adjust selectors

**Missing data**: Check if content loads dynamically - use `page.waitForLoadState('networkidle')` 

**Incorrect selectors**: Use `screenshotWithAccessibilityLabels()` to visually identify elements

**Performance**: For large datasets, use `state` object to store intermediate results between playwriter calls
