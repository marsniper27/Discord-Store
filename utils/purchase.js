//purchase.js
const {incrementFields, findEntryByID} = require("mars-simple-mongodb")

async function purchaseItem(user, server, cost, paymentType){
    const userInfo = await findEntryByID("users",server,user);
    if(paymentType === "coins"){
        if( cost > userInfo.coins)return false;
        await incrementFields('users',server,user,{coins: -cost});
        return true;
    }else if(paymentType === "superCoins"){
        if( cost > userInfo.superCoins)return;
        await incrementFields('users',server,user,{superCoins: -cost});
        return true;
    }
}

module.exports = { purchaseItem }