/* Exact one-serving measures used by all WorldCook recipes. */
window.WC_MEASURE={
"beer":[150,"ml"],"cassava":[150,"g"],"cuttlefish":[130,"g"],"herring":[80,"g"],"mayonnaise":[1,"tbsp"],"mustard":[1,"tbsp"],"prunes":[40,"g"],"red onion":[60,"g"],"rye bread":[60,"g"],"tuna":[130,"g"],"yeast":[1,"tsp"],
"celery":[50,"g"],"cocoa":[1,"tbsp"],"coconut":[20,"g"],"cucumber":[80,"g"],"kale":[100,"g"],"kefir":[180,"ml"],"split peas":[80,"g"],
"apple":[100,"g"],"bok choy":[80,"g"],"breadcrumbs":[30,"g"],"butter":[1,"tbsp"],"horseradish":[1,"tbsp"],"pork":[120,"g"],"puff pastry":[100,"g"],"rabbit":[150,"g"],"red wine":[80,"ml"],"ricotta":[100,"g"],"veal":[150,"g"],"wheat noodles":[90,"g"],
"avocado":[70,"g"],"bacon":[50,"g"],"barley":[60,"g"],"barley flour":[25,"g"],"berries":[60,"g"],"black pepper":[0.5,"tsp"],"beef broth":[250,"ml"],"capers":[1,"tbsp"],"cilantro":[15,"g"],"corn":[100,"g"],"cream":[60,"ml"],"dill":[5,"g"],"dried lime":[1,"piece"],"fenugreek":[5,"g"],"fish stock":[250,"ml"],"kidney beans":[90,"g"],"leek":[50,"g"],"oat flour":[25,"g"],"parsley":[15,"g"],"pea flour":[25,"g"],"plantain":[100,"g"],"pomegranate molasses":[1.5,"tbsp"],"rye flour":[25,"g"],"salmon":[80,"g"],"sour cream":[30,"g"],"walnut":[35,"g"],
"ackee":[100,"g"],"almonds":[12,"g"],"basil":[5,"g"],"bay leaf":[1,"piece"],"beans":[100,"g"],"beef":[120,"g"],"bell pepper":[80,"g"],"black beans":[100,"g"],"bread":[60,"g"],"cabbage":[120,"g"],"carrot":[70,"g"],"cheese":[35,"g"],"chicken":[130,"g"],"chickpeas":[100,"g"],"coconut milk":[120,"ml"],"cornmeal":[70,"g"],"cumin":[1,"tsp"],"curry powder":[1.5,"tsp"],"egg":[1,"piece"],"eggplant":[150,"g"],"fish":[130,"g"],"flour":[100,"g"],"garlic":[1,"piece"],"ginger":[8,"g"],"ground beef":[120,"g"],"herbs":[8,"g"],"lamb":[140,"g"],"lemon":[0.5,"piece"],"lentils":[80,"g"],"lime":[0.5,"piece"],"milk":[120,"ml"],"mushroom":[80,"g"],"olive oil":[1,"tbsp"],"onion":[80,"g"],"orange":[0.5,"piece"],"paprika":[1,"tsp"],"beetroot":[120,"g"],"molokhia":[100,"g"],"pumpkin":[150,"g"],"pasta":[90,"g"],"potato":[180,"g"],"rice":[80,"g"],"rice noodles":[90,"g"],"salt":[0.25,"tsp"],"sausage":[100,"g"],"soy sauce":[1,"tbsp"],"spinach":[60,"g"],"sugar":[1,"tsp"],"tahini":[1,"tbsp"],"tomato":[120,"g"],"tortilla":[2,"piece"],"vinegar":[1,"tbsp"],"water":[250,"ml"],"yogurt":[100,"g"],"zucchini":[120,"g"]
};
window.MEASURE_UI={
en:{base:"Amounts per serving",piece:"pc",tbsp:"tbsp",tsp:"tsp"},
ko:{base:"1인분 기준",piece:"개",tbsp:"큰술",tsp:"작은술"},
es:{base:"Cantidades por porción",piece:"ud.",tbsp:"cda",tsp:"cdta"},
ja:{base:"1人分の分量",piece:"個",tbsp:"大さじ",tsp:"小さじ"},
zh:{base:"每1人份用量",piece:"个",tbsp:"汤匙",tsp:"茶匙"}
};
function wcRound(n){return Math.round(n*100)/100}
function formatMeasure(v,count,l){
 if(!v)return "";
 const ui=window.MEASURE_UI[l]||window.MEASURE_UI.en;
 const amount=wcRound(v[0]*count),unit=ui[v[1]]||v[1];
 return amount+" "+unit;
}
R.forEach(r=>{r.q=r.x.map(x=>window.WC_MEASURE[x]||[50,"g"])});
