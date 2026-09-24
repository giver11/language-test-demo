/* Exact one-serving measures used by all WorldCook recipes. */
window.WC_MEASURE={
"almonds":[12,"g"],"basil":[5,"g"],"bay leaf":[1,"piece"],"beans":[100,"g"],"beef":[120,"g"],"bell pepper":[80,"g"],"black beans":[100,"g"],"bread":[60,"g"],"cabbage":[120,"g"],"carrot":[70,"g"],"cheese":[35,"g"],"chicken":[130,"g"],"chickpeas":[100,"g"],"coconut milk":[120,"ml"],"cornmeal":[70,"g"],"cumin":[1,"tsp"],"curry powder":[1.5,"tsp"],"egg":[1,"piece"],"eggplant":[150,"g"],"fish":[130,"g"],"flour":[100,"g"],"garlic":[1,"piece"],"ginger":[8,"g"],"ground beef":[120,"g"],"herbs":[8,"g"],"lamb":[140,"g"],"lemon":[0.5,"piece"],"lentils":[80,"g"],"lime":[0.5,"piece"],"milk":[120,"ml"],"mushroom":[80,"g"],"olive oil":[1,"tbsp"],"onion":[80,"g"],"orange":[0.5,"piece"],"pasta":[90,"g"],"potato":[180,"g"],"rice":[80,"g"],"rice noodles":[90,"g"],"salt":[0.25,"tsp"],"sausage":[100,"g"],"soy sauce":[1,"tbsp"],"spinach":[60,"g"],"sugar":[1,"tsp"],"tahini":[1,"tbsp"],"tomato":[120,"g"],"tortilla":[2,"piece"],"vinegar":[1,"tbsp"],"water":[250,"ml"],"yogurt":[100,"g"],"zucchini":[120,"g"]
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
