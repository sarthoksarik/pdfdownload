var changeTurnOver = this.getField("dropDown").value;
fields.forEach((fi, ind) => {
    if(changeTurnOver == 0){
        this.getField(fi).value = "0 EURO";
    }
    else {
        this.getField(fi).value = imd[objs[ind]].netPrem[changeTurnOver];
    }
   
})

