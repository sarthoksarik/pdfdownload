var turnOver = this.getField('dropDown').value;

var imd = JSON.parse(this.getField('imported_data').value);
var firstOpenFlag = this.getField("firstOpen").value
var fields = ['m_netPrem', 'l_netPrem', 'xl_netPrem']
var objs = ['m', 'l', 'xl']
if (firstOpenFlag == 0) {
    var fieldNames = ['m_sumins_pi', 'l_sumins_pi', 'xl_sumins_pi', 
    'm_sumins_gl', 'l_sumins_gl', 'xl_sumins_gl', 
    'm_deductible', 'l_deductible', 'xl_deductible', 
    'compDetail', 'softTypeText']
    for (var i = 0; i < 11; i++) {
        this.getField(fieldNames[i]).textFont = "MarkelSans-Regular"
    }
    var tahomaFields = ['softType', 'customerRev', 'emplRev', 'creditRating', 'companyAge', 'total']
    for (var j = 0; j < 6; j++) {
        this.getField(tahomaFields[j]).textFont = "Tahoma,Bold"
    }
    this.getField("dropDown").value = imd.defaultTrnOvr;
    fields.forEach((fi, ind) => {
        
        this.getField(fi).value = imd[objs[ind]].netPrem[imd.defaultTrnOvr];  
       
    })

    firstOpenFlag.value = 1;

}
