const roundMoneyDefault = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export function calculateFinancialSnapshot(invoices, expenses, roundMoney = roundMoneyDefault){
    const revenue=invoices.reduce((sum,invoice)=>sum+Number(invoice.totalUsd||0),0);
    const productNetSales=invoices.reduce((sum,invoice)=>{
      const lineSubtotal=(Array.isArray(invoice.items)?invoice.items:[]).reduce((subtotal,item)=>subtotal+Number(item.unitPriceUsd||0)*Number(item.quantity||0),0);
      const subtotal=invoice.subtotalUsd==null?lineSubtotal:Number(invoice.subtotalUsd||0);
      return sum+Math.max(0,subtotal-Number(invoice.discountUsd||0));
    },0);
    const deliveryIncome=roundMoney(invoices.reduce((sum,invoice)=>sum+Number(invoice.deliveryFeeUsd||0),0));
    const costOfSales=invoices.reduce((sum,invoice)=>(Array.isArray(invoice.items)?invoice.items:[]).reduce((subtotal,item)=>subtotal+Number(item.unitCostUsd||0)*Number(item.quantity||0),sum),0);
    const grossProfit=roundMoney(productNetSales-costOfSales);
    const operatingExpenses=roundMoney(expenses.reduce((sum,item)=>sum+Number(item.amountUsd||0),0));
    return {revenue:roundMoney(revenue),productNetSales:roundMoney(productNetSales),deliveryIncome,costOfSales:roundMoney(costOfSales),grossProfit,operatingExpenses,netProfit:roundMoney(grossProfit+deliveryIncome-operatingExpenses)};
  }

export function calculatePayablesSnapshot(legacyPurchases, supplierInvoices, roundMoney = roundMoneyDefault){
    const legacyPurchasePayables=roundMoney((Array.isArray(legacyPurchases)?legacyPurchases:[]).reduce(
      (sum,purchase)=>sum+Math.max(0,Number(purchase.totalUsd||0)-Number(purchase.paidUsd||0)),0
    ));
    const supplierInvoicePayables=roundMoney((Array.isArray(supplierInvoices)?supplierInvoices:[])
      .filter(invoice=>String(invoice.status||"")!=="Anulada")
      .reduce((sum,invoice)=>sum+Math.max(0,Number(invoice.amountUsd||0)-Number(invoice.paidUsd||0)),0));
    return {
      legacyPurchasePayables,
      supplierInvoicePayables,
      total:roundMoney(legacyPurchasePayables+supplierInvoicePayables)
    };
  }
