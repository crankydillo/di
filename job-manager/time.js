function formatTime(date) {
    function pad2(value) {
        if (value < 10) return "0" + value;
        else return value + "";
    }

    return pad2(date.getHours()) + ":" + pad2(date.getMinutes()) + ":" + 
        pad2(date.getSeconds());
}

// chronograph helper thing
function updateDuration(jobId) {

    function inc(curr, next) {
        var currSpan = $('#' + jobId).find('#' + curr);
        var currSpanTxt = currSpan.text();
        var curr = 0;
        if (currSpanTxt.charAt(0) == '0')
            curr = parseInt(currSpanTxt.substring(1));
        else
            curr = parseInt(currSpanTxt);
        if (curr == 59) {
            currSpan.text("00");
            inc("mins", "hrs");
        } else {
            if (curr < 9) 
                currSpan.text("0" + (curr + 1));
            else {
                currSpan.text(curr + 1 + "");
            }
        }
    }

    inc("secs", "mins");
}

