const {EmbedBuilder} = require("discord.js")
const {SolPayment} = require("Sol-Store-Module")
const {purchaseItem} = require("../utils/purchase")

const solPayment = new SolPayment();

class Item {
    constructor (
        _id,
        name,
        description,
        quantity,
        cost,
        itemType,
        paymentType,
    ){
        this._id = _id,
        this.name = name;
        this.description = description;
        this.quantity = quantity;
        this.cost = cost;
        this.itemType = itemType;
        this.paymentType = paymentType;
    }

    show(){
        const itemEmbed = new EmbedBuilder()
            .setTitle(this.name)
            .setDescription(this.description)
            .setFields([
                { name:`Item Type:`,value: `${this.paymentType}`},
                { name:`Quantity:`,value: `${this.quantity}`},
                { name:`Cost:`,value: `${this.cost} ${this.paymentType}`}
            ])
        return itemEmbed
    }

    async purchase(interaction){
        let result;
        if(this.paymentType !== "SOL"){
             result = await purchaseItem(interaction.user.id,interaction.guildId,this.cost,this.paymentType)
        }else{
            result = await solPayment.performSale(interaction,this.cost * solPayment.lps)
        }
        return result;
    }
}

module.exports={ Item }