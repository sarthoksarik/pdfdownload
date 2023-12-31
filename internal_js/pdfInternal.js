fields.forEach((fi, ind) => {
    if(turnOver == 0){
        this.getField(fi).value = "0 EURO";
    }
    else {
        this.getField(fi).value = imd[objs[ind]].netPrem[turnOver];
    }
   
})

