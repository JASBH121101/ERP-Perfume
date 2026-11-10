import test from "node:test";
import assert from "node:assert/strict";
import {calculateProductPricing} from "../assets/js/product-pricing.mjs";
test("price includes all cost components and configured 35% margin",()=>{
 const r=calculateProductPricing({purchaseCost:18,freightCost:.8,packagingCost:.7,allocatedOperatingCost:1.5,variableFeeRate:3,targetMargin:35,promotionalMargin:20});
 assert.equal(r.fullUnitCost,21); assert.equal(r.breakEvenPrice,21.65);
 assert.equal(r.recommendedPrice,33.87); assert.equal(r.promotionalPrice,27.27);
});
test("pricing rejects impossible margin and fee combinations",()=>assert.throws(()=>calculateProductPricing({purchaseCost:10,variableFeeRate:70,targetMargin:35}),RangeError));
test("35% margin on a 65 cost yields a 100 selling price",()=>{
 const r=calculateProductPricing({purchaseCost:65,targetMargin:35});
 assert.equal(r.recommendedPrice,100); assert.equal(r.estimatedProfitAtRecommendedPrice,35);
});
