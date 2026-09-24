/* WorldCook Nutrition v1 — estimates from the app's per-serving ingredient measures. */
(function(){
const KCAL={almonds:69,basil:1,"bay leaf":2,beans:127,beef:250,"bell pepper":25,"black beans":132,bread:159,cabbage:30,carrot:29,cheese:140,chicken:215,chickpeas:164,"coconut milk":230,cornmeal:253,cumin:8,"curry powder":10,egg:72,eggplant:38,fish:170,flour:364,garlic:4,ginger:6,"ground beef":300,herbs:3,lamb:350,lemon:9,lentils:282,lime:10,milk:73,mushroom:18,"olive oil":119,onion:32,orange:31,pasta:320,potato:139,rice:288,"rice noodles":320,salt:0,sausage:300,"soy sauce":9,spinach:14,sugar:16,tahini:89,tomato:22,tortilla:240,vinegar:3,water:0,yogurt:61,zucchini:20};
const UI={
en:{label:"Estimated calories",unit:"kcal",note:"Estimate per serving, calculated from listed ingredient amounts. Actual calories vary by product and cooking method."},
ko:{label:"예상 열량",unit:"kcal",note:"표시된 재료 계량을 합산한 1인분 예상치입니다. 제품과 조리법에 따라 실제 열량은 달라질 수 있습니다."},
es:{label:"Calorías estimadas",unit:"kcal",note:"Estimación por porción calculada con las cantidades indicadas. Puede variar según el producto y la cocción."},
ja:{label:"推定カロリー",unit:"kcal",note:"表示された材料量から算出した1人分の目安です。製品や調理法により実際の値は異なります。"},
zh:{label:"预计热量",unit:"千卡",note:"根据所列食材用量计算的每份估算值，实际热量会因产品和烹饪方式而异。"}
};
window.wcCalories=function(recipe,count){const base=(recipe.x||[]).reduce((sum,name)=>sum+(KCAL[name]??35),0);return Math.max(1,Math.round(base*(count||1)))};
window.wcNutritionText=function(l){return UI[l]||UI.en};
})();