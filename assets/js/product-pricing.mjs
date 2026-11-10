function nn(value,label){const n=Number(value);if(!Number.isFinite(n)||n<0)throw new RangeError(label+" debe ser igual o mayor que cero.");return n;}
const money=value=>Math.round((value+Number.EPSILON)*100)/100;
export function calculateProductPricing({purchaseCost=0,freightCost=0,importOrHandlingCost=0,packagingCost=0,
 allocatedOperatingCost=0,variableFeeRate=0,targetMargin=35,promotionalMargin=20,currency="USD"}={}) {
 const components={purchaseCost:nn(purchaseCost,"Costo de compra"),freightCost:nn(freightCost,"Transporte"),
 importOrHandlingCost:nn(importOrHandlingCost,"Importación/manejo"),packagingCost:nn(packagingCost,"Empaque"),
 allocatedOperatingCost:nn(allocatedOperatingCost,"Gastos operativos asignados")};
 const fee=nn(variableFeeRate,"Gastos variables"),margin=nn(targetMargin,"Margen"),promo=nn(promotionalMargin,"Margen promocional");
 if(fee>=100||margin>=100||promo>=100||fee+margin>=100||fee+promo>=100)throw new RangeError("La suma de margen y gastos variables debe ser menor que 100%.");
 const cost=Object.values(components).reduce((a,b)=>a+b,0);
 const floor=cost/(1-fee/100),recommended=cost/(1-(fee+margin)/100),promotional=cost/(1-(fee+promo)/100);
 return {currency:String(currency||"USD"),components:Object.fromEntries(Object.entries(components).map(([k,v])=>[k,money(v)])),
 fullUnitCost:money(cost),variableFeeRate:fee,targetMargin:margin,promotionalMargin:promo,
 breakEvenPrice:money(floor),recommendedPrice:money(recommended),promotionalPrice:money(promotional),
 estimatedProfitAtRecommendedPrice:money(recommended*(1-fee/100)-cost),estimatedMarginAtRecommendedPrice:margin};
}
